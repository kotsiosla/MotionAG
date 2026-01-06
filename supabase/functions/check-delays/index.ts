import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_DELAY_MINUTES = 5; // Minimum delay to notify
const NOTIFY_COOLDOWN_MINUTES = 30; // Don't re-notify about same route within this time

// Store last notification times per route (in-memory, resets on function restart)
const lastNotified = new Map<string, number>();

interface TripUpdate {
  tripId?: string;
  routeId?: string;
  vehicleId?: string;
  stopTimeUpdates?: Array<{
    stopId?: string;
    arrivalTime?: number;
    arrivalDelay?: number;
    departureTime?: number;
    departureDelay?: number;
  }>;
}

interface DelayInfo {
  routeId: string;
  tripId: string;
  delayMinutes: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    console.log('[check-delays] Starting delay check...');
    
    // Fetch trip updates via gtfs-proxy (which handles the protobuf parsing)
    const proxyUrl = `${SUPABASE_URL}/functions/v1/gtfs-proxy/trips`;
    console.log('[check-delays] Fetching from:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
      headers: { 
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('[check-delays] Failed to fetch trips:', response.status);
      return new Response(JSON.stringify({ error: 'Failed to fetch trip data', status: response.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const tripData = await response.json();
    const trips: TripUpdate[] = tripData.data || [];
    
    console.log('[check-delays] Received', trips.length, 'trips');
    
    if (trips.length === 0) {
      return new Response(JSON.stringify({ message: 'No trip data available', checked: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Find significant delays
    const delays: DelayInfo[] = [];
    
    for (const trip of trips) {
      if (!trip.routeId || !trip.stopTimeUpdates?.length) continue;
      
      // Find max delay for this trip
      let maxDelaySeconds = 0;
      for (const stu of trip.stopTimeUpdates) {
        const delay = stu.arrivalDelay || stu.departureDelay || 0;
        if (delay > maxDelaySeconds) {
          maxDelaySeconds = delay;
        }
      }
      
      const delayMinutes = Math.round(maxDelaySeconds / 60);
      
      if (delayMinutes >= MIN_DELAY_MINUTES) {
        delays.push({
          routeId: trip.routeId,
          tripId: trip.tripId || '',
          delayMinutes,
        });
      }
    }
    
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
      if (delay.delayMinutes > current) {
        routeDelays.set(delay.routeId, delay.delayMinutes);
      }
    }
    
    const now = Date.now();
    const cooldownMs = NOTIFY_COOLDOWN_MINUTES * 60 * 1000;
    
    // Filter routes that haven't been notified recently
    const routesToNotify: Array<{ routeId: string; delayMinutes: number }> = [];
    
    for (const [routeId, delayMinutes] of routeDelays) {
      const lastTime = lastNotified.get(routeId) || 0;
      if (now - lastTime > cooldownMs) {
        routesToNotify.push({ routeId, delayMinutes });
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
    
    // Get push subscriptions
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
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});