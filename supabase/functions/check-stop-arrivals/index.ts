import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StopNotificationSettings {
  stopId: string;
  stopName: string;
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  push: boolean;
  beforeMinutes: number;
}

interface StopSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  stop_notifications: StopNotificationSettings[];
  last_notified: Record<string, number>;
}

// Send push notification - simplified version
async function sendPushNotification(
  endpoint: string,
  _p256dh: string,
  _auth: string,
  payload: string,
  vapidPublicKey: string,
  _vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(endpoint);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'TTL': '86400',
      'Urgency': 'high',
    };

    if (endpoint.includes('fcm.googleapis.com') || endpoint.includes('push.services.mozilla.com')) {
      headers['Authorization'] = `key=${vapidPublicKey.substring(0, 40)}`;
    }

    console.log(`Attempting push to: ${url.hostname}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: payload,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.log(`Push failed with status ${response.status}: ${responseText}`);
      return { success: false, statusCode: response.status, error: responseText };
    }

    console.log(`Push succeeded with status ${response.status}`);
    return { success: true, statusCode: response.status };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Push network error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all subscriptions with stop notifications
    const { data: subscriptions, error: subError } = await supabase
      .from('stop_notification_subscriptions')
      .select('*')
      .not('stop_notifications', 'is', null);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No stop notification subscriptions found');
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking ${subscriptions.length} subscriptions for stop arrivals`);

    // Fetch trip updates from gtfs-proxy
    let tripUpdates: unknown[] = [];
    
    try {
      const proxyResponse = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/trips?operator=all`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        }
      });
      
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        if (proxyData.data && Array.isArray(proxyData.data)) {
          tripUpdates = proxyData.data;
          console.log(`Got ${tripUpdates.length} trip updates from gtfs-proxy`);
        }
      } else {
        console.log('gtfs-proxy returned:', proxyResponse.status);
      }
    } catch (e) {
      console.error('Error fetching from gtfs-proxy:', e);
    }

    if (tripUpdates.length === 0) {
      console.log('No trip updates available');
      return new Response(JSON.stringify({ checked: subscriptions.length, sent: 0, reason: 'no_trips' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const notificationsSent: string[] = [];

    // Check each subscription
    for (const sub of subscriptions as StopSubscription[]) {
      const stopSettings = sub.stop_notifications || [];
      const enabledSettings = Array.isArray(stopSettings) 
        ? stopSettings.filter(s => s && s.enabled && s.push)
        : [];
      
      if (enabledSettings.length === 0) continue;

      const lastNotified = sub.last_notified || {};

      for (const settings of enabledSettings) {
        for (const trip of tripUpdates as Record<string, unknown>[]) {
          const stopTimeUpdates = (trip.stopTimeUpdates || trip.stop_time_updates || []) as Record<string, unknown>[];
          if (!Array.isArray(stopTimeUpdates)) continue;

          for (const stu of stopTimeUpdates) {
            const stuStopId = stu.stopId || stu.stop_id;
            const arrival = stu.arrival as Record<string, unknown> | undefined;
            const arrivalTime = (stu.arrivalTime || stu.arrival_time || (arrival && arrival.time)) as number | undefined;
            
            if (stuStopId !== settings.stopId || !arrivalTime) continue;

            const secondsUntil = arrivalTime - nowSeconds;
            const minutesUntil = Math.round(secondsUntil / 60);

            if (minutesUntil > 0 && minutesUntil <= settings.beforeMinutes) {
              const routeId = (trip.routeId || trip.route_id || 'unknown') as string;
              const notifKey = `${settings.stopId}-${routeId}-${Math.floor(arrivalTime / 60)}`;
              const lastNotifTime = lastNotified[notifKey] || 0;
              
              if (nowSeconds - lastNotifTime < 120) continue;

              try {
                const urgencyEmoji = minutesUntil <= 1 ? '🚨' : minutesUntil <= 2 ? '⚠️' : '🚌';
                const routeName = (trip.routeShortName || trip.route_short_name || routeId) as string;

                const payload = JSON.stringify({
                  title: `${urgencyEmoji} ${routeName} σε ${minutesUntil}'`,
                  body: `Φτάνει στη στάση "${settings.stopName}"`,
                  icon: '/pwa-192x192.png',
                  url: `/?stop=${settings.stopId}`,
                  tag: `arrival-${settings.stopId}-${routeId}`,
                  vibrate: [200, 100, 200, 100, 200],
                  requireInteraction: minutesUntil <= 2,
                });

                const result = await sendPushNotification(
                  sub.endpoint,
                  sub.p256dh,
                  sub.auth,
                  payload,
                  VAPID_PUBLIC_KEY,
                  VAPID_PRIVATE_KEY
                );

                if (result.success) {
                  console.log(`Push sent for stop ${settings.stopId}, route ${routeId}, ${minutesUntil} min`);
                  lastNotified[notifKey] = nowSeconds;
                  notificationsSent.push(notifKey);
                } else {
                  console.error('Push error:', result.statusCode, result.error);
                  
                  if (result.statusCode === 410 || result.statusCode === 404) {
                    await supabase.from('stop_notification_subscriptions').delete().eq('id', sub.id);
                    console.log('Removed invalid subscription');
                  }
                }
              } catch (pushError: unknown) {
                const errorMessage = pushError instanceof Error ? pushError.message : String(pushError);
                console.error('Push error:', errorMessage);
              }
            }
          }
        }
      }

      if (Object.keys(lastNotified).length > 0) {
        await supabase
          .from('stop_notification_subscriptions')
          .update({ last_notified: lastNotified })
          .eq('id', sub.id);
      }
    }

    console.log(`Checked ${subscriptions.length} subscriptions, sent ${notificationsSent.length} notifications`);

    return new Response(JSON.stringify({ 
      checked: subscriptions.length,
      sent: notificationsSent.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in check-stop-arrivals:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});