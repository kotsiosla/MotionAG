import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed domains for notification URLs (security measure)
const ALLOWED_URL_DOMAINS = [
  'motionbus.cy',
  'lovable.app',
  'lovableproject.com',
  'localhost',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== Trip Reminder Check Started ===');

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get current time in Cyprus timezone (EET/EEST)
    const now = new Date();
    const cyprusOffset = 2; // Cyprus is UTC+2 (or +3 in summer)
    const cyprusTime = new Date(now.getTime() + (cyprusOffset * 60 * 60 * 1000));
    
    console.log('Current Cyprus time:', cyprusTime.toISOString());

    // Find trips that need reminders:
    // - Not yet reminded
    // - Departure is within the reminder window (now + reminder_minutes)
    // - Departure is in the future
    const { data: upcomingTrips, error: tripsError } = await supabase
      .from('saved_trips')
      .select('*')
      .eq('reminder_sent', false)
      .gte('departure_date', now.toISOString().split('T')[0]); // Today or future

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch trips' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${upcomingTrips?.length || 0} unsent reminders to check`);

    if (!upcomingTrips || upcomingTrips.length === 0) {
      console.log('No trips to check');
      return new Response(JSON.stringify({ 
        checked: 0,
        notified: 0,
        message: 'No pending reminders'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter trips that need notification now
    const tripsToNotify = upcomingTrips.filter(trip => {
      const departureDateTime = new Date(`${trip.departure_date}T${trip.departure_time}`);
      const minutesUntilDeparture = (departureDateTime.getTime() - now.getTime()) / (1000 * 60);
      
      // Notify if within reminder window and in the future
      const shouldNotify = minutesUntilDeparture > 0 && minutesUntilDeparture <= trip.reminder_minutes;
      
      if (shouldNotify) {
        console.log(`Trip ${trip.id}: ${Math.round(minutesUntilDeparture)} mins until departure, reminder at ${trip.reminder_minutes} mins`);
      }
      
      return shouldNotify;
    });

    console.log(`${tripsToNotify.length} trips need notification now`);

    if (tripsToNotify.length === 0) {
      return new Response(JSON.stringify({ 
        checked: upcomingTrips.length,
        notified: 0,
        message: 'No trips within reminder window'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Import web-push
    const { default: webpush } = await import('https://esm.sh/web-push@3.6.7');
    
    webpush.setVapidDetails(
      'mailto:noreply@motionbus.cy',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Get push subscriptions for these trips
    const endpoints = [...new Set(tripsToNotify.map(t => t.push_endpoint))];
    
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('endpoint', endpoints);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
    }

    const subscriptionMap = new Map(
      (subscriptions || []).map(s => [s.endpoint, s])
    );

    let notifiedCount = 0;
    const failedEndpoints: string[] = [];

    // Send notifications
    for (const trip of tripsToNotify) {
      const subscription = subscriptionMap.get(trip.push_endpoint);
      
      if (!subscription) {
        console.log(`No subscription found for endpoint: ${trip.push_endpoint.slice(-20)}`);
        continue;
      }

      const departureDateTime = new Date(`${trip.departure_date}T${trip.departure_time}`);
      const minutesUntilDeparture = Math.round((departureDateTime.getTime() - now.getTime()) / (1000 * 60));
      
      const routeText = trip.route_names?.join(' → ') || 'Διαδρομή';
      
      const payload = JSON.stringify({
        title: `🚌 Αναχώρηση σε ${minutesUntilDeparture} λεπτά!`,
        body: `${trip.origin_stop_name} → ${trip.destination_stop_name}\nΓραμμή: ${routeText}`,
        icon: '/pwa-192x192.png',
        url: '/?view=saved',
        tag: `trip-${trip.id}`,
      });

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);

        console.log(`✓ Push sent for trip ${trip.id}`);
        
        // Mark as sent
        await supabase
          .from('saved_trips')
          .update({ reminder_sent: true })
          .eq('id', trip.id);

        notifiedCount++;
      } catch (error: any) {
        console.error(`✗ Push failed for trip ${trip.id}:`, error.statusCode || error.message);
        
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          failedEndpoints.push(subscription.endpoint);
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
          console.log('Removed invalid subscription');
        }
      }
    }

    // Clean up old trips (past departures)
    const { error: cleanupError } = await supabase
      .from('saved_trips')
      .delete()
      .lt('departure_date', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (cleanupError) {
      console.log('Cleanup error (non-critical):', cleanupError.message);
    }

    const duration = Date.now() - startTime;
    console.log(`=== Trip Reminder Check Complete (${duration}ms) ===`);
    console.log(`Checked: ${upcomingTrips.length}, Notified: ${notifiedCount}`);

    return new Response(JSON.stringify({ 
      checked: upcomingTrips.length,
      notified: notifiedCount,
      failed: tripsToNotify.length - notifiedCount,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-trip-reminders:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
