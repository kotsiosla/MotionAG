
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Query for ANY subscription containing stop 2877
        // Using simple text search on the JSONB column
        const { data, error } = await supabaseClient
            .from('stop_notification_subscriptions')
            .select('*')

        if (error) throw error

        // Filter manually for 2877 in the JSON array
        const matches = data?.filter(row => {
            if (!row.stop_notifications) return false;
            const notifs = Array.isArray(row.stop_notifications)
                ? row.stop_notifications
                : JSON.parse(JSON.stringify(row.stop_notifications));

            return notifs.some((n: any) => n.stopId === '2877');
        }) || [];

        return new Response(
            JSON.stringify({
                success: true,
                count: matches.length,
                matches: matches.map(m => ({
                    id: m.id,
                    endpoint: m.endpoint ? '***' : null,
                    stop_notifications: m.stop_notifications
                }))
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
