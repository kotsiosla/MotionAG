import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('stop_notification_subscriptions')
      .select('*');

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions', details: fetchError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No subscriptions found',
        fixed: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let fixed = 0;
    const results: Array<{ id: string; endpoint: string; status: string }> = [];

    // Check each subscription
    for (const sub of subscriptions) {
      const stopNotifications = sub.stop_notifications;
      let needsFix = false;
      let newValue: unknown = null;

      // Check if null or empty
      if (stopNotifications === null || stopNotifications === undefined) {
        needsFix = true;
        newValue = [];
      } else if (Array.isArray(stopNotifications) && stopNotifications.length === 0) {
        needsFix = true;
        newValue = [];
      } else if (typeof stopNotifications === 'string' && (stopNotifications === '[]' || stopNotifications === '')) {
        needsFix = true;
        newValue = [];
      }

      if (needsFix) {
        const { error: updateError } = await supabase
          .from('stop_notification_subscriptions')
          .update({ 
            stop_notifications: newValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);

        if (updateError) {
          results.push({
            id: sub.id,
            endpoint: sub.endpoint?.substring(0, 50) || 'unknown',
            status: `Error: ${updateError.message}`
          });
        } else {
          fixed++;
          results.push({
            id: sub.id,
            endpoint: sub.endpoint?.substring(0, 50) || 'unknown',
            status: 'Fixed (set to empty array)'
          });
        }
      } else {
        results.push({
          id: sub.id,
          endpoint: sub.endpoint?.substring(0, 50) || 'unknown',
          status: 'OK (has data)'
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: `Checked ${subscriptions.length} subscriptions`,
      fixed,
      total: subscriptions.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

