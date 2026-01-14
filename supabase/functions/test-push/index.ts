
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
// Use local helper instead of external library
import { sendPushNotification } from './push_helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[test-push:${requestId}] Request received:`, req.method, new Date().toISOString());

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log(`[test-push:${requestId}] ===== FUNCTION START =====`);

    // 1. Read Environment Variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    // Hardcoded fallback keys (safety valve)
    const FALLBACK_VAPID_PUBLIC_KEY = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';
    const FALLBACK_VAPID_PRIVATE_KEY = 'ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk';

    // 2. Prepare VAPID Keys (Raw Base64URL)
    // CRITICAL FIX: Prioritize HARDCODED keys because the environment variables seem to be mismatched
    // The frontend is using the hardcoded key starting with 'BG5V...'
    // So the backend MUST use the corresponding private key 'ynT-...'
    let pubKey = FALLBACK_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;
    let privKey = FALLBACK_VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY;

    // Clean keys
    pubKey = pubKey.trim().replace(/\s/g, '');
    privKey = privKey.trim().replace(/\s/g, '');

    console.log(`[test-push:${requestId}] Using Public Key: ${pubKey.substring(0, 10)}...`);

    // 3. Parse Request Body
    let title = '🚌 Test Push Notification';
    let body = 'Οι ειδοποιήσεις λειτουργούν σωστά!';
    let icon = '/MotionAG/pwa-192x192.png';

    try {
      const requestBody = await req.json();
      if (requestBody.title) title = requestBody.title;
      if (requestBody.body) body = requestBody.body;
      if (requestBody.icon !== undefined) icon = requestBody.icon;
    } catch (e) {
      console.log(`[test-push:${requestId}] No request body or invalid JSON, using defaults`);
    }

    // 4. Fetch Subscriptions
    console.log(`[test-push:${requestId}] Fetching subscriptions...`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: stopSubs } = await supabase.from('stop_notification_subscriptions').select('endpoint, p256dh, auth');
    const { data: pushSubs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');

    const allSubs = [...(stopSubs || []), ...(pushSubs || [])];

    // Deduplicate by endpoint
    const uniqueEndpoints = new Map();
    allSubs.forEach(sub => uniqueEndpoints.set(sub.endpoint, sub));
    const subscriptions = Array.from(uniqueEndpoints.values());

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found', requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Prepare Payload
    const payload = JSON.stringify({
      title,
      body,
      url: 'https://kotsiosla.github.io/MotionAG/',
      icon: icon || 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
      badge: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
      tag: 'motion-bus-' + Date.now(),
      renotify: true
    });

    // 6. Send Notifications
    console.log(`[test-push:${requestId}] Sending to ${subscriptions.length} subscriptions (Batch Processing)...`);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 20 to avoid timeouts/limits
    const BATCH_SIZE = 20;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      console.log(`[test-push:${requestId}] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(subscriptions.length / BATCH_SIZE)}`);

      await Promise.all(batch.map(async (sub) => {
        try {
          const endpointHostname = new URL(sub.endpoint).hostname;
          if (endpointHostname.includes('wns.') || endpointHostname.includes('notify.windows.com')) {
            return; // Skip WNS
          }

          const result = await sendPushNotification(
            sub.endpoint,
            sub.p256dh,
            sub.auth,
            payload,
            pubKey,
            privKey,
            'mailto:info@motionbus.cy'
          );

          if (result.success) {
            sent++;
          } else {
            failed++;
            // Don't log every failure to keep logs clean, just unique ones or sample
            if (errors.length < 10) {
              errors.push(`${endpointHostname}: ${result.statusCode} - ${result.error?.substring(0, 50)}`);
            }

            // Handle 410 Gone / 404 Not Found (Expired)
            if (result.statusCode === 410 || result.statusCode === 404) {
              await supabase.from('stop_notification_subscriptions').delete().eq('endpoint', sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          }
        } catch (err: any) {
          failed++;
          console.error(`[test-push:${requestId}] Error processing sub: ${err.message}`);
          errors.push(err.message);
        }
      }));
    }

    console.log(`[test-push:${requestId}] Done. Sent: ${sent}, Failed: ${failed}`);
    return new Response(JSON.stringify({
      sent,
      failed,
      errors: errors.slice(0, 5),
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[test-push:${requestId}] Global error:`, err);
    return new Response(JSON.stringify({ error: err.message, requestId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
