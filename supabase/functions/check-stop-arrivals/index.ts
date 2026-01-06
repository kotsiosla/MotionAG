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

    // Fetch GTFS trip updates to get real-time arrivals
    const gtfsResponse = await fetch('https://transitfeeds.com/api/proxy?apiKey=bda6c6c0-7f75-4c59-99c6-e8b6c6f3d56b&feedId=1040&type=tripUpdates', {
      headers: { 'Accept': 'application/x-protobuf' }
    }).catch(() => null);

    if (!gtfsResponse || !gtfsResponse.ok) {
      console.log('Could not fetch GTFS data');
      return new Response(JSON.stringify({ checked: 0, sent: 0, error: 'GTFS unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Parse GTFS data (simplified - in production use proper protobuf parsing)
    const tripUpdates: any[] = [];
    
    try {
      // Use the gtfs-proxy function instead for parsed data
      const proxyResponse = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy?type=tripUpdates&operator=all`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        }
      });
      
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        if (proxyData.data) {
          tripUpdates.push(...proxyData.data);
        }
      }
    } catch (e) {
      console.error('Error fetching from gtfs-proxy:', e);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const notificationsSent: string[] = [];

    // Import web-push
    const { default: webpush } = await import('https://esm.sh/web-push@3.6.7');
    
    webpush.setVapidDetails(
      'mailto:noreply@motionbus.cy',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Check each subscription
    for (const sub of subscriptions as StopSubscription[]) {
      const stopSettings = sub.stop_notifications || [];
      const enabledSettings = stopSettings.filter(s => s.enabled && s.push);
      
      if (enabledSettings.length === 0) continue;

      const lastNotified = sub.last_notified || {};

      for (const settings of enabledSettings) {
        // Find arrivals at this stop
        for (const trip of tripUpdates) {
          if (!trip.stopTimeUpdates) continue;

          for (const stu of trip.stopTimeUpdates) {
            if (stu.stopId !== settings.stopId || !stu.arrivalTime) continue;

            const secondsUntil = stu.arrivalTime - nowSeconds;
            const minutesUntil = Math.round(secondsUntil / 60);

            // Check if within notification window
            if (minutesUntil > 0 && minutesUntil <= settings.beforeMinutes) {
              const notifKey = `${settings.stopId}-${trip.routeId}-${Math.floor(stu.arrivalTime / 60)}`;
              const lastNotifTime = lastNotified[notifKey] || 0;
              
              // Only notify once per arrival (with 2 minute grace period)
              if (nowSeconds - lastNotifTime < 120) continue;

              // Send push notification
              try {
                const urgencyEmoji = minutesUntil <= 1 ? '🚨' : minutesUntil <= 2 ? '⚠️' : '🚌';
                const routeName = trip.routeShortName || trip.routeId || 'Λεωφορείο';

                const payload = JSON.stringify({
                  title: `${urgencyEmoji} ${routeName} σε ${minutesUntil}'`,
                  body: `Φτάνει στη στάση "${settings.stopName}"`,
                  icon: '/pwa-192x192.png',
                  url: `/?stop=${settings.stopId}`,
                  tag: `arrival-${settings.stopId}-${trip.routeId}`,
                  vibrate: [200, 100, 200, 100, 200],
                  requireInteraction: minutesUntil <= 2,
                });

                const subscription = {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                  },
                };

                await webpush.sendNotification(subscription, payload);
                console.log(`Push sent for stop ${settings.stopId}, route ${trip.routeId}, ${minutesUntil} min`);
                
                // Update last notified
                lastNotified[notifKey] = nowSeconds;
                notificationsSent.push(notifKey);
              } catch (pushError: any) {
                console.error('Push error:', pushError.statusCode || pushError.message);
                
                // Remove invalid subscriptions
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                  await supabase.from('stop_notification_subscriptions').delete().eq('id', sub.id);
                  console.log('Removed invalid subscription');
                }
              }
            }
          }
        }
      }

      // Update last_notified in database
      if (notificationsSent.length > 0) {
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});