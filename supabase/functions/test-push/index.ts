import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { ApplicationServerKeys, generatePushHTTPRequest } from 'https://esm.sh/webpush-webcrypto@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert standard base64 to base64url
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Loading VAPID keys...');

    // Create ApplicationServerKeys - these need to be in base64url format
    let applicationServerKeys;
    try {
      applicationServerKeys = await ApplicationServerKeys.fromJSON({
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
      });
      console.log('ApplicationServerKeys loaded successfully');
    } catch (keyError) {
      console.error('Failed to load VAPID keys:', keyError);
      return new Response(JSON.stringify({ error: 'Invalid VAPID key format', details: String(keyError) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all subscriptions from stop_notification_subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('stop_notification_subscriptions')
      .select('endpoint, p256dh, auth');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: '🚌 Test Push Notification',
      body: 'Οι ειδοποιήσεις λειτουργούν σωστά!',
      icon: '/pwa-192x192.png',
      url: '/',
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        console.log(`Sending push to: ${new URL(sub.endpoint).hostname}`);

        // Convert keys to base64url format if they're in standard base64
        const p256dh = toBase64Url(sub.p256dh);
        const auth = toBase64Url(sub.auth);

        const { headers, body, endpoint } = await generatePushHTTPRequest({
          applicationServerKeys,
          payload,
          target: {
            endpoint: sub.endpoint,
            keys: {
              p256dh,
              auth,
            },
          },
          adminContact: 'mailto:info@motionbus.cy',
          ttl: 86400,
          urgency: 'high',
        });

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
        });

        if (response.ok) {
          sent++;
          console.log(`Push succeeded with status ${response.status}`);
        } else {
          const responseText = await response.text();
          failed++;
          errors.push(`${response.status}: ${responseText.substring(0, 100)}`);
          console.log(`Push failed with status ${response.status}: ${responseText}`);
          
          // Remove invalid subscriptions
          if (response.status === 410 || response.status === 404) {
            await supabase.from('stop_notification_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('Removed invalid subscription');
          }
        }
      } catch (error: any) {
        failed++;
        errors.push(error.message || String(error));
        console.error('Push error:', error);
      }
    }

    console.log(`Results: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({ sent, failed, total: subscriptions.length, errors: errors.slice(0, 5) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
