import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

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

// Base64 URL encode
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Send push notification - simplified version
// Note: Full Web Push requires VAPID signing and payload encryption
// For now, this is a basic implementation that logs attempts
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
    
    // Basic headers for push
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'TTL': '86400',
      'Urgency': 'high',
    };

    // For FCM endpoints, we need the VAPID key
    if (endpoint.includes('fcm.googleapis.com') || endpoint.includes('push.services.mozilla.com')) {
      // Add VAPID public key as a header (simplified, real implementation needs JWT)
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
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
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