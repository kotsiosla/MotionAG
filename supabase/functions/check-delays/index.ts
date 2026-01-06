import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GTFS_RT_BASE_URL = "http://20.19.98.194:8328/Api/api/gtfs-realtime";
const MIN_DELAY_MINUTES = 5; // Minimum delay to notify
const NOTIFY_COOLDOWN_MINUTES = 30; // Don't re-notify about same route within this time

// Store last notification times per route (in-memory, resets on function restart)
const lastNotified = new Map<string, number>();

// Simple protobuf varint reader
function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  
  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    result |= (byte & 0x7F) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  return { value: result, bytesRead };
}

function readString(data: Uint8Array, offset: number, length: number): string {
  const decoder = new TextDecoder();
  return decoder.decode(data.slice(offset, offset + length));
}

interface DelayInfo {
  routeId: string;
  tripId: string;
  delaySeconds: number;
  stopId?: string;
}

// Parse GTFS-RT protobuf to extract delays
function parseGtfsRtForDelays(data: Uint8Array): DelayInfo[] {
  const delays: DelayInfo[] = [];
  
  try {
    let offset = 0;
    
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes;
        
        if (fieldNumber === 1) { // entity
          const entityData = data.slice(offset, offset + length);
          const delayInfo = parseEntity(entityData);
          if (delayInfo) {
            delays.push(delayInfo);
          }
        }
        
        offset += length;
      } else if (wireType === 0) {
        const { bytesRead } = readVarint(data, offset);
        offset += bytesRead;
      } else if (wireType === 5) {
        offset += 4;
      } else if (wireType === 1) {
        offset += 8;
      } else {
        break;
      }
    }
  } catch (e) {
    console.error('Error parsing GTFS-RT:', e);
  }
  
  return delays;
}

function parseEntity(data: Uint8Array): DelayInfo | null {
  let offset = 0;
  let tripId = '';
  let routeId = '';
  let maxDelay = 0;
  
  try {
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes;
        
        if (fieldNumber === 3) { // trip_update
          const tripUpdateData = data.slice(offset, offset + length);
          const result = parseTripUpdate(tripUpdateData);
          tripId = result.tripId;
          routeId = result.routeId;
          maxDelay = result.maxDelay;
        }
        
        offset += length;
      } else if (wireType === 0) {
        const { bytesRead } = readVarint(data, offset);
        offset += bytesRead;
      } else if (wireType === 5) {
        offset += 4;
      } else if (wireType === 1) {
        offset += 8;
      } else {
        break;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  if (routeId && maxDelay >= MIN_DELAY_MINUTES * 60) {
    return { routeId, tripId, delaySeconds: maxDelay };
  }
  
  return null;
}

function parseTripUpdate(data: Uint8Array): { tripId: string; routeId: string; maxDelay: number } {
  let offset = 0;
  let tripId = '';
  let routeId = '';
  let maxDelay = 0;
  
  try {
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes;
        
        if (fieldNumber === 1) { // trip descriptor
          const tripDesc = parseTripDescriptor(data.slice(offset, offset + length));
          tripId = tripDesc.tripId;
          routeId = tripDesc.routeId;
        } else if (fieldNumber === 2) { // stop_time_update
          const delay = parseStopTimeUpdate(data.slice(offset, offset + length));
          if (delay > maxDelay) {
            maxDelay = delay;
          }
        }
        
        offset += length;
      } else if (wireType === 0) {
        const { bytesRead } = readVarint(data, offset);
        offset += bytesRead;
      } else if (wireType === 5) {
        offset += 4;
      } else if (wireType === 1) {
        offset += 8;
      } else {
        break;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  return { tripId, routeId, maxDelay };
}

function parseTripDescriptor(data: Uint8Array): { tripId: string; routeId: string } {
  let offset = 0;
  let tripId = '';
  let routeId = '';
  
  try {
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes;
        
        if (fieldNumber === 1) { // trip_id
          tripId = readString(data, offset, length);
        } else if (fieldNumber === 5) { // route_id
          routeId = readString(data, offset, length);
        }
        
        offset += length;
      } else if (wireType === 0) {
        const { bytesRead } = readVarint(data, offset);
        offset += bytesRead;
      } else {
        break;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  return { tripId, routeId };
}

function parseStopTimeUpdate(data: Uint8Array): number {
  let offset = 0;
  let maxDelay = 0;
  
  try {
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes;
        
        if (fieldNumber === 2 || fieldNumber === 3) { // arrival or departure
          const delay = parseStopTimeEvent(data.slice(offset, offset + length));
          if (delay > maxDelay) {
            maxDelay = delay;
          }
        }
        
        offset += length;
      } else if (wireType === 0) {
        const { bytesRead } = readVarint(data, offset);
        offset += bytesRead;
      } else {
        break;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  return maxDelay;
}

function parseStopTimeEvent(data: Uint8Array): number {
  let offset = 0;
  let delay = 0;
  
  try {
    while (offset < data.length) {
      const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
      offset += tagBytes;
      
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 0) {
        const { value, bytesRead } = readVarint(data, offset);
        offset += bytesRead;
        
        if (fieldNumber === 1) { // delay
          // Handle signed varint (zigzag decoding)
          delay = (value >> 1) ^ -(value & 1);
        }
      } else if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = readVarint(data, offset);
        offset += lenBytes + length;
      } else {
        break;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  return delay;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('[check-delays] Starting delay check...');
    
    // Fetch GTFS-RT trip updates
    const response = await fetch(`${GTFS_RT_BASE_URL}/TripUpdates?operatorIds=1,2,3`, {
      headers: { 'Accept': 'application/x-protobuf' },
    });
    
    if (!response.ok) {
      console.error('[check-delays] Failed to fetch GTFS-RT data:', response.status);
      return new Response(JSON.stringify({ error: 'Failed to fetch GTFS-RT data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const data = new Uint8Array(await response.arrayBuffer());
    console.log('[check-delays] Received', data.length, 'bytes of GTFS-RT data');
    
    // Parse delays from protobuf
    const delays = parseGtfsRtForDelays(data);
    console.log('[check-delays] Found', delays.length, 'significant delays');
    
    if (delays.length === 0) {
      return new Response(JSON.stringify({ message: 'No significant delays found', checked: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Group delays by route and find max delay per route
    const routeDelays = new Map<string, number>();
    for (const delay of delays) {
      const current = routeDelays.get(delay.routeId) || 0;
      if (delay.delaySeconds > current) {
        routeDelays.set(delay.routeId, delay.delaySeconds);
      }
    }
    
    const now = Date.now();
    const cooldownMs = NOTIFY_COOLDOWN_MINUTES * 60 * 1000;
    
    // Filter routes that haven't been notified recently
    const routesToNotify: Array<{ routeId: string; delayMinutes: number }> = [];
    
    for (const [routeId, delaySeconds] of routeDelays) {
      const lastTime = lastNotified.get(routeId) || 0;
      if (now - lastTime > cooldownMs) {
        routesToNotify.push({
          routeId,
          delayMinutes: Math.round(delaySeconds / 60),
        });
        lastNotified.set(routeId, now);
      }
    }
    
    console.log('[check-delays] Routes to notify:', routesToNotify.length);
    
    if (routesToNotify.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'Delays found but already notified recently',
        delayedRoutes: routeDelays.size,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Get push subscriptions that match these routes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');
    
    if (subError) {
      console.error('[check-delays] Error fetching subscriptions:', subError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[check-delays] Found', subscriptions?.length || 0, 'subscriptions');
    
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No push subscriptions to notify',
        delayedRoutes: routesToNotify.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Import web-push
    const { default: webpush } = await import('https://esm.sh/web-push@3.6.7');
    
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('[check-delays] VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    webpush.setVapidDetails(
      'mailto:noreply@motionbus.cy',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    
    let notificationsSent = 0;
    let notificationsFailed = 0;
    
    // Send notifications for each delayed route
    for (const { routeId, delayMinutes } of routesToNotify) {
      // Find subscriptions that include this route
      const matchingSubs = subscriptions.filter(sub => {
        if (!sub.route_ids || sub.route_ids.length === 0) {
          // No specific routes = subscribe to all
          return true;
        }
        return sub.route_ids.includes(routeId);
      });
      
      if (matchingSubs.length === 0) continue;
      
      const payload = JSON.stringify({
        title: '🚌 Καθυστέρηση Λεωφορείου',
        body: `Γραμμή ${routeId}: +${delayMinutes} λεπτά καθυστέρηση`,
        icon: '/pwa-192x192.png',
        url: `/?route=${routeId}`,
        tag: `delay-${routeId}`,
      });
      
      for (const sub of matchingSubs) {
        try {
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          
          await webpush.sendNotification(subscription, payload);
          notificationsSent++;
          console.log('[check-delays] Sent notification for route', routeId);
        } catch (error: any) {
          notificationsFailed++;
          console.error('[check-delays] Push failed:', error.statusCode || error.message);
          
          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('[check-delays] Removed invalid subscription');
          }
        }
      }
    }
    
    console.log('[check-delays] Complete. Sent:', notificationsSent, 'Failed:', notificationsFailed);
    
    return new Response(JSON.stringify({
      success: true,
      delayedRoutes: routesToNotify.length,
      notificationsSent,
      notificationsFailed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[check-delays] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});