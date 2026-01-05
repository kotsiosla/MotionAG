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
    // Only allow calls with service role key (server-side only)
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

    // Get subscriptions - filter by routeIds if provided
    let query = supabase.from('push_subscriptions').select('*');
    
    // If routeIds provided, filter subscriptions that have overlapping route_ids
    const { data: subscriptions, error: fetchError } = await query;

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

    // Import web-push compatible library for Deno
    const { default: webpush } = await import('https://esm.sh/web-push@3.6.7');
    
    webpush.setVapidDetails(
      'mailto:noreply@motionbus.cy',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const results = await Promise.allSettled(
      targetSubscriptions.map(async (sub) => {
        try {
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          
          await webpush.sendNotification(subscription, payload);
          console.log('Push sent successfully to endpoint hash:', sub.endpoint.slice(-20));
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error('Push failed, status:', error.statusCode);
          
          // Remove invalid subscriptions (410 Gone or 404 Not Found)
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('Removed invalid subscription');
          }
          
          return { success: false, endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
