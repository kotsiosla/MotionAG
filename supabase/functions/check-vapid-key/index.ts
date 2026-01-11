import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
    const key = Deno.env.get('VAPID_PUBLIC_KEY');
    return new Response(JSON.stringify({
        key: key || 'MISSING',
        prefix: key ? key.substring(0, 10) : 'N/A'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
