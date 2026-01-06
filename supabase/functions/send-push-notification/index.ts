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

// Send push notification using webpush-webcrypto
async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  applicationServerKeys: Awaited<ReturnType<typeof ApplicationServerKeys.generate>>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    console.log(`Sending push to: ${new URL(endpoint).hostname}`);

    const { headers, body, endpoint: targetEndpoint } = await generatePushHTTPRequest({
      applicationServerKeys,
      payload,
      target: {
        endpoint,
        keys: {
          p256dh,
          auth,
        },
      },
      adminContact: 'mailto:info@motionbus.cy',
      ttl: 86400,
      urgency: 'high',
    });

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers,
      body,
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
    console.error('Push error:', errorMessage);
    return { success: false, error: errorMessage };
  }
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

    // SECURITY: Require authorization header with service role key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Invalid authorization token');
      return new Response(JSON.stringify({ error: 'Forbidden - Invalid token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create ApplicationServerKeys from VAPID keys
    let applicationServerKeys: Awaited<ReturnType<typeof ApplicationServerKeys.generate>>;
    try {
      applicationServerKeys = await ApplicationServerKeys.fromJSON({
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
      });
      console.log('ApplicationServerKeys loaded successfully');
    } catch (keyError) {
      console.error('Failed to load VAPID keys:', keyError);
      return new Response(JSON.stringify({ error: 'Invalid VAPID key format' }), {
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

    const results = await Promise.allSettled(
      targetSubscriptions.map(async (sub) => {
        const result = await sendPushNotification(
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          payload,
          applicationServerKeys
        );
        
        if (!result.success) {
          // Remove invalid subscriptions
          if (result.statusCode === 410 || result.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('Removed invalid subscription');
          }
        }
        
        return result;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    const failed = results.length - successful;

    console.log(`Push results: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({ 
      sent: successful, 
      failed,
      total: targetSubscriptions.length 
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
