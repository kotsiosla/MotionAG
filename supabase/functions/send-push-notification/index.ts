import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { ApplicationServerKeys, generatePushHTTPRequest } from 'https://esm.sh/webpush-webcrypto@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  routeIds?: string[];
  icon?: string;
  url?: string;
}

// Allowed domains for notification URLs (security measure)
const ALLOWED_URL_DOMAINS = [
  'motionbus.cy',
  'lovable.app',
  'lovableproject.com',
  'localhost',
];

// Convert standard base64 to base64url
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Create ApplicationServerKeys using webpush-webcrypto library
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

    const { title, body, routeIds, icon, url }: PushPayload = await req.json();
    
    // SECURITY: Input validation
    if (!title || typeof title !== 'string' || title.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid title - required, max 100 chars' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!body || typeof body !== 'string' || body.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid body - required, max 500 chars' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // SECURITY: Validate URL if provided
    if (url) {
      try {
        const parsed = new URL(url);
        const isAllowed = ALLOWED_URL_DOMAINS.some(domain => 
          parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
        if (!isAllowed) {
          console.error('URL domain not allowed:', parsed.hostname);
          return new Response(JSON.stringify({ error: 'URL domain not allowed' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log('Sending push notification:', { title, body: body.substring(0, 50), routeIds });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get subscriptions
    const { data: subscriptions, error: fetchError } = await supabase.from('push_subscriptions').select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    // Filter subscriptions by routeIds if specified
    let targetSubscriptions = subscriptions || [];
    if (routeIds && routeIds.length > 0) {
      targetSubscriptions = targetSubscriptions.filter(sub => {
        if (!sub.route_ids || sub.route_ids.length === 0) return false;
        return sub.route_ids.some((id: string) => routeIds.includes(id));
      });
      console.log(`Filtered to ${targetSubscriptions.length} subscriptions for routes:`, routeIds);
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/pwa-192x192.png',
      url: url || '/',
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of targetSubscriptions) {
      try {
        console.log(`Sending push to: ${new URL(sub.endpoint).hostname}`);

        // Convert keys to base64url format if they're in standard base64
        const p256dh = toBase64Url(sub.p256dh);
        const auth = toBase64Url(sub.auth);

        const { headers, body: requestBody, endpoint } = await generatePushHTTPRequest({
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
          body: requestBody,
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
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('Removed invalid subscription');
          }
        }
      } catch (error: unknown) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(errorMessage);
        console.error('Push error:', errorMessage);
      }
    }

    console.log(`Push results: ${sent} successful, ${failed} failed`);

    return new Response(JSON.stringify({ 
      sent, 
      failed,
      total: targetSubscriptions.length,
      errors: errors.slice(0, 5)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
