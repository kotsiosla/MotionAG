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
  console.log('[test-push] Request received:', req.method, new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    console.log('[test-push] CORS preflight, returning OK');
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  try {
    console.log('[test-push] Starting function execution...');
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
    console.log('VAPID_PUBLIC_KEY length:', VAPID_PUBLIC_KEY?.length || 0);
    console.log('VAPID_PRIVATE_KEY length:', VAPID_PRIVATE_KEY?.length || 0);
    console.log('VAPID_PUBLIC_KEY starts with:', VAPID_PUBLIC_KEY?.substring(0, 50) || 'MISSING');
    console.log('VAPID_PRIVATE_KEY starts with:', VAPID_PRIVATE_KEY?.substring(0, 50) || 'MISSING');

    // Create ApplicationServerKeys - support both JWK format (JSON) and base64url format
    let applicationServerKeys;
    try {
      let publicKey: any = VAPID_PUBLIC_KEY;
      let privateKey: any = VAPID_PRIVATE_KEY;
      
      // Try to parse as JSON first (JWK format)
      try {
        const publicKeyJson = JSON.parse(VAPID_PUBLIC_KEY);
        const privateKeyJson = JSON.parse(VAPID_PRIVATE_KEY);
        publicKey = publicKeyJson;
        privateKey = privateKeyJson;
        console.log('VAPID keys are in JWK format (JSON)');
      } catch (e) {
        // Not JSON, assume base64url format - use as-is
        console.log('VAPID keys are in base64url format, using as-is');
        // ApplicationServerKeys.fromJSON can accept base64url strings directly
      }
      
      applicationServerKeys = await ApplicationServerKeys.fromJSON({
        publicKey,
        privateKey,
      });
      console.log('ApplicationServerKeys loaded successfully');
    } catch (keyError) {
      console.error('Failed to load VAPID keys:', keyError);
      console.error('Error details:', String(keyError));
      console.error('VAPID_PUBLIC_KEY type:', typeof VAPID_PUBLIC_KEY);
      console.error('VAPID_PRIVATE_KEY type:', typeof VAPID_PRIVATE_KEY);
      return new Response(JSON.stringify({ 
        error: 'Invalid VAPID key format', 
        details: String(keyError),
        hint: 'VAPID keys should be in JWK format (JSON) or base64url format. Check Supabase secrets.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body to get title and body (if provided)
    let requestBody: { title?: string; body?: string } = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      console.log('No request body provided, using defaults');
    }

    const title = requestBody.title || '🚌 Test Push Notification';
    const body = requestBody.body || 'Οι ειδοποιήσεις λειτουργούν σωστά!';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get subscriptions from BOTH tables
    const { data: stopSubs, error: stopError } = await supabase
      .from('stop_notification_subscriptions')
      .select('endpoint, p256dh, auth');

    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (stopError) console.error('Error fetching stop subscriptions:', stopError);
    if (pushError) console.error('Error fetching push subscriptions:', pushError);

    // Merge subscriptions, avoiding duplicates by endpoint
    const allSubs = [...(stopSubs || []), ...(pushSubs || [])];
    const uniqueEndpoints = new Map();
    allSubs.forEach(sub => uniqueEndpoints.set(sub.endpoint, sub));
    const subscriptions = Array.from(uniqueEndpoints.values());

    console.log(`Found ${stopSubs?.length || 0} stop subs, ${pushSubs?.length || 0} push subs, ${subscriptions.length} unique total`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body,
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

    const duration = Date.now() - startTime;
    console.log(`[test-push] Results: ${sent} sent, ${failed} failed (took ${duration}ms)`);

    const responseBody = { sent, failed, total: subscriptions.length, errors: errors.slice(0, 5) };
    console.log('[test-push] Returning response:', JSON.stringify(responseBody));
    
    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[test-push] Error after', duration, 'ms:', error);
    console.error('[test-push] Error stack:', error instanceof Error ? error.stack : String(error));
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
