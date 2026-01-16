
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
    const FALLBACK_VAPID_PUBLIC_KEY = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';
    const FALLBACK_VAPID_PRIVATE_KEY = 'ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk';

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

    let totalSent = 0;
    const errors: string[] = [];

    try {
        console.log('[Worker-Manual-Adaptive] Starting 55s notification loop...');
        // Validation check removed, we use fallbacks above

        // 1. Fetch Active Subscriptions
        const { data: subs, error: subError } = await supabase
            .from('stop_notification_subscriptions')
            .select('*')
            .not('stop_notifications', 'is', null);

        if (subError) throw subError;
        if (!subs || subs.length === 0) {
            console.log('[Worker] No active subscriptions found');
            return new Response(JSON.stringify({ status: 'ok', totalSent: 0, message: 'No subscriptions' }), { headers: corsHeaders });
        }
        console.log(`[Worker] Found ${subs.length} total subscriptions`);

        // 2. Group by StopId
        const stopsToCheck = new Set<string>();
        const subMap = new Map<string, any[]>();

        for (const sub of subs) {
            console.log(`[Worker] Processing sub ${sub.id.slice(0, 8)}`);
            const settings = sub.stop_notifications;
            console.log(`[Worker]   - stop_notifications type: ${typeof settings}, isArray: ${Array.isArray(settings)}`);

            if (!Array.isArray(settings)) {
                console.log(`[Worker]   - SKIPPING: not an array`);
                continue;
            }

            console.log(`[Worker]   - Array length: ${settings.length}`);
            for (const setting of settings) {
                console.log(`[Worker]     - Checking setting for stop ${setting.stopId} (enabled: ${setting.enabled}, push: ${setting.push})`);
                if (setting.enabled && setting.push) {
                    console.log(`[Worker]       - ADDING stop ${setting.stopId} to check list`);
                    stopsToCheck.add(setting.stopId);
                    if (!subMap.has(setting.stopId)) subMap.set(setting.stopId, []);
                    subMap.get(setting.stopId)!.push({ sub, setting });
                }
            }
        }

        console.log(`[Worker] total stops to check: ${stopsToCheck.size}`);

        // 3. Process Each Stop
        await Promise.all(Array.from(stopsToCheck).map(async (stopId) => {
            console.log(`[Worker] STOP ${stopId}: Entering processing map`);
            // FETCH MERGED ARRIVALS
            console.log(`[Worker] STOP ${stopId}: Fetching arrivals from proxy...`);
            const arrivalsUrl = `${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`;
            console.log(`[Worker] STOP ${stopId}: URL: ${arrivalsUrl}`);

            const resp = await fetch(arrivalsUrl, {
                headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
            });

            if (!resp.ok) {
                console.log(`[Worker] STOP ${stopId}: Failed to fetch arrivals: ${resp.status}`);
                return;
            }
            const { data: arrivals } = await resp.json();
            console.log(`[Worker] STOP ${stopId}: Found ${arrivals?.length || 0} arrivals`);
            if (!arrivals || arrivals.length === 0) return;

            const relevantSubs = subMap.get(stopId) || [];
            console.log(`[Worker] STOP ${stopId}: Found ${relevantSubs.length} relevant subs`);

            for (const { sub, setting } of relevantSubs) {
                console.log(`[Worker] STOP ${stopId}: Processing sub ${sub.id.slice(0, 8)}`);
                for (const arrival of arrivals) {
                    const routeId = arrival.routeId;
                    const routeName = arrival.routeShortName;
                    const arrivalTime = arrival.bestArrivalTime;
                    console.log(`[Worker] STOP ${stopId}:   Arrival ${routeName} (route ${routeId}) @ ${arrivalTime}`);

                    if (!arrivalTime) {
                        console.log(`[Worker] STOP ${stopId}:     SKIPPING: No arrivalTime`);
                        continue;
                    }

                    const nowSec = Math.floor(Date.now() / 1000);
                    const minsUntil = Math.round((arrivalTime - nowSec) / 60);
                    console.log(`[Worker] STOP ${stopId}:     Minutes until: ${minsUntil}`);

                    // Thresholds
                    const userThreshold = setting.beforeMinutes || 10;
                    console.log(`[Worker] STOP ${stopId}:     User threshold: ${userThreshold}`);
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

                    if (!targetAlertLevel) {
                        continue;
                    }

                    // --- NEW: Watched Trips & Routes Filtering ---
                    const notifyType = setting.notifyType || 'all';
                    const watchedTrips = setting.watchedTrips || [];
                    const watchedRoutes = setting.watchedRoutes || [];
                    const isWatchedTrip = watchedTrips.includes(arrival.tripId);
                    const isWatchedRoute = watchedRoutes.includes(arrival.routeId);
                    const isWatched = isWatchedTrip || isWatchedRoute;

                    if (notifyType === 'selected' && !isWatched) {
                        // console.log(`[Worker] STOP ${stopId}:     SKIPPING: Trip ${arrival.tripId} or route ${arrival.routeId} not in watched lists`);
                        continue;
                    }
                    console.log(`[Worker] STOP ${stopId}:     MATCH! Arrival ${routeName} (${arrival.tripId}) ${minsUntil}m <= Threshold ${targetAlertLevel} (Watched: ${isWatched ? (isWatchedTrip ? 'Trip' : 'Route') : 'All'})`);

                    // Check Log - include route_id and trip_id for better deduplication
                    const { data: logEntries, error: logError } = await supabase
                        .from('notifications_log')
                        .select('id')
                        .eq('subscription_id', sub.id)
                        .eq('stop_id', stopId)
                        .eq('route_id', routeId)
                        .eq('alert_level', targetAlertLevel)
                        .filter('metadata->>trip_id', 'eq', arrival.tripId || 'unknown') // Filter by trip_id in metadata
                        .limit(1);

                    if (logError) {
                        console.error(`[Worker] STOP ${stopId}:     Error checking logs: ${logError.message}`);
                    }

                    if (logEntries && logEntries.length > 0) {
                        console.log(`[Worker] STOP ${stopId}:     Already notified for level ${targetAlertLevel}`);
                        continue;
                    }

                    console.log(`[Worker] STOP ${stopId}:     NOT previously notified for level ${targetAlertLevel}. Proceeding to send...`);

                    // SEND PUSH (Manual VAPID + TTL fix)
                    const urgency = minsUntil <= 5 ? '🚨' : '🚌';
                    // iOS PWA prefers 'notification' wrapper for structure
                    const payload = JSON.stringify({
                        notification: {
                            title: `${urgency} Bus ${routeName} in ${minsUntil}'`,
                            body: `Arriving at ${setting.stopName}`,
                            icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
                            badge: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
                            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
                            requireInteraction: true,
                            data: {
                                url: `https://kotsiosla.github.io/MotionAG/?stop=${stopId}`,
                                logUrl: SUPABASE_URL,
                                logKey: SUPABASE_SERVICE_ROLE_KEY.slice(0, 10) === 'eyJhbGciOi' ? Deno.env.get('SUPABASE_ANON_KEY') : SUPABASE_SERVICE_ROLE_KEY,
                                stopId: stopId,
                                tripId: arrival.tripId
                            }
                        }
                    });

                    try {
                        const result = await sendPushNotification(
                            sub.endpoint,
                            sub.p256dh,
                            sub.auth,
                            payload,
                            VAPID_PUBLIC_KEY!,
                            VAPID_PRIVATE_KEY!
                        );

                        if (result.success) {
                            console.log(`[Worker] Push Sent (Manual): Sub ${sub.id.slice(0, 4)} Route ${routeId} @ ${minsUntil}m`);
                            totalSent++;
                            const { error: insError } = await supabase.from('notifications_log').insert({
                                subscription_id: sub.id,
                                stop_id: stopId,
                                route_id: routeId,
                                alert_level: targetAlertLevel,
                                metadata: {
                                    trip_id: arrival.tripId || 'unknown',
                                    push_success: true,
                                    status_code: result.statusCode,
                                    match_type: isWatchedTrip ? 'trip' : (isWatchedRoute ? 'route' : 'all'),
                                    notify_type: notifyType
                                }
                            });
                            if (insError) console.error(`[Worker] Error logging notification: ${insError.message}`);
                        } else {
                            console.error('Push Service Error:', result.statusCode, result.error);
                            errors.push(`Push Error ${result.statusCode}: ${result.error}`);

                            // Log the error even on failure
                            await supabase.from('notifications_log').insert({
                                subscription_id: sub.id,
                                stop_id: stopId,
                                route_id: routeId,
                                alert_level: targetAlertLevel,
                                metadata: {
                                    trip_id: arrival.tripId || 'unknown',
                                    push_success: false,
                                    status_code: result.statusCode,
                                    error: result.error
                                }
                            });

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

        return new Response(JSON.stringify({ status: 'ok', totalSent, errors }), { headers: corsHeaders });

    } catch (e) {
        console.error('[Worker] Fatal:', e);
        return new Response(JSON.stringify({ error: String(e), errors }), { status: 500, headers: corsHeaders });
    }
});
