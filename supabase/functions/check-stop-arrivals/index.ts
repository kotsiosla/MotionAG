
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { sendPushNotification } from './push.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MAIN WORKER FUNCTION
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    let VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    // Hardcoded fallback keys (matching frontend)
    const FALLBACK_VAPID_PUBLIC_KEY = 'BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg';
    const FALLBACK_VAPID_PRIVATE_KEY = 'oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso';

    // Auto-fix/Fallback Logic
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || VAPID_PUBLIC_KEY.includes('+') || VAPID_PUBLIC_KEY.endsWith('=')) {
        console.log('[Worker] Using fallback VAPID keys (Environment keys are missing or in wrong format)');
        VAPID_PUBLIC_KEY = FALLBACK_VAPID_PUBLIC_KEY;
        VAPID_PRIVATE_KEY = FALLBACK_VAPID_PRIVATE_KEY;
    }

    // CONFIG: 55s Loop (Long Polling)
    const MAX_DURATION_MS = 55 * 1000;
    const POLL_INTERVAL_MS = 10 * 1000;
    const START_TIME = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[Worker-Manual-Adaptive] Starting 55s notification loop...');
    let iterations = 0;
    let totalSent = 0;
    const errors: string[] = [];

    try {
        // Validation check removed, we use fallbacks above

        // CLEANUP: Remove logs older than 1 HOUR to prevent DB growth
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const cleanupDate = new Date(Date.now() - ONE_HOUR_MS).toISOString();
        const { error: cleanupError } = await supabase
            .from('notifications_log')
            .delete()
            .lt('sent_at', cleanupDate);

        if (cleanupError) {
            console.error('[Worker] Cleanup Error:', cleanupError.message);
        }

        // --- LOOP START ---
        while (Date.now() - START_TIME < MAX_DURATION_MS) {
            iterations++;

            // 1. Fetch Active Subscriptions
            const { data: subs, error: subError } = await supabase
                .from('stop_notification_subscriptions')
                .select('*')
                .not('stop_notifications', 'is', null);

            if (subError) throw subError;
            if (!subs || subs.length === 0) {
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
                continue;
            }

            // 2. Group by StopId
            const stopsToCheck = new Set<string>();
            const subMap = new Map<string, any[]>();

            for (const sub of subs) {
                const settings = sub.stop_notifications || [];
                for (const setting of settings) {
                    if (setting.enabled && setting.push) {
                        stopsToCheck.add(setting.stopId);
                        if (!subMap.has(setting.stopId)) subMap.set(setting.stopId, []);
                        subMap.get(setting.stopId)!.push({ sub, setting });
                    }
                }
            }

            // 3. Process Each Stop
            await Promise.all(Array.from(stopsToCheck).map(async (stopId) => {
                // FETCH MERGED ARRIVALS
                const resp = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`, {
                    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
                });

                if (!resp.ok) return;
                const { data: arrivals } = await resp.json();
                if (!arrivals || arrivals.length === 0) return;

                const relevantSubs = subMap.get(stopId) || [];

                for (const { sub, setting } of relevantSubs) {
                    for (const arrival of arrivals) {
                        const routeId = arrival.routeId;
                        const routeName = arrival.routeShortName;
                        const arrivalTime = arrival.bestArrivalTime;
                        if (!arrivalTime) continue;

                        const nowSec = Math.floor(Date.now() / 1000);
                        const minsUntil = Math.round((arrivalTime - nowSec) / 60);

                        // Thresholds
                        const userThreshold = setting.beforeMinutes || 10;
                        const thresholds = [10, 5, 2].filter(t => t <= userThreshold);
                        if (userThreshold > 10) thresholds.unshift(userThreshold);
                        thresholds.sort((a, b) => b - a);

                        let targetAlertLevel: number | null = null;
                        for (const t of thresholds) {
                            if (minsUntil <= t) {
                                targetAlertLevel = t;
                                break;
                            }
                        }

                        if (!targetAlertLevel) continue;

                        // Check Log
                        const { data: logs } = await supabase
                            .from('notifications_log')
                            .select('alert_level, sent_at')
                            .eq('subscription_id', sub.id)
                            .eq('route_id', routeId)
                            .gt('sent_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
                            .lte('alert_level', targetAlertLevel);

                        if (logs && logs.length > 0) continue;

                        // SEND PUSH (Manual VAPID + TTL fix)
                        const urgency = minsUntil <= 5 ? '🚨' : '🚌';
                        const payload = JSON.stringify({
                            title: `${urgency} Bus ${routeName} in ${minsUntil}'`,
                            body: `Arriving at ${setting.stopName}`,
                            icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
                            data: { url: `https://kotsiosla.github.io/MotionAG/?stop=${stopId}` }
                        });

                        try {
                            const result = await sendPushNotification(
                                sub.endpoint,
                                sub.p256dh,
                                sub.auth,
                                payload,
                                VAPID_PUBLIC_KEY,
                                VAPID_PRIVATE_KEY
                            );

                            if (result.success) {
                                console.log(`[Worker] Push Sent (Manual): Sub ${sub.id.slice(0, 4)} Route ${routeId} @ ${minsUntil}m`);
                                totalSent++;
                                await supabase.from('notifications_log').insert({
                                    subscription_id: sub.id,
                                    stop_id: stopId,
                                    route_id: routeId,
                                    alert_level: targetAlertLevel
                                });
                            } else {
                                console.error('Push Service Error:', result.statusCode, result.error);
                                errors.push(`Push Error ${result.statusCode}: ${result.error}`);
                                if (result.statusCode === 410 || result.statusCode === 404) {
                                    await supabase.from('stop_notification_subscriptions').delete().eq('id', sub.id);
                                }
                            }

                        } catch (err) {
                            console.error('Push Failed:', err);
                            errors.push(String(err));
                        }
                    }
                }
            }));

            const elapsed = Date.now() - START_TIME;
            if (elapsed > MAX_DURATION_MS) break;
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }

        return new Response(JSON.stringify({ status: 'ok', iterations, totalSent, errors }), { headers: corsHeaders });

    } catch (e) {
        console.error('[Worker] Fatal:', e);
        return new Response(JSON.stringify({ error: String(e), errors }), { status: 500, headers: corsHeaders });
    }
});
