import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64url encode/decode (Crucial for VAPID)
function base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padding);
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// VAPID & Encryption (Simplified for brevity, assuming existing helpers work or we re-implement standard WebPush)
// NOTE: Re-implementing the VAPID/Encryption helpers fully to ensure standalone stability.

async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: audience, exp: now + 86400, sub: subject };
    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsignedToken = `${headerB64}.${payloadB64}`;
    const privateKeyBytes = base64UrlDecode(privateKeyBase64);

    // Import Key
    const pkcs8Header = new Uint8Array([0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20]);
    const pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyBytes]);
    const cryptoKey = await crypto.subtle.importKey('pkcs8', pkcs8Key, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(unsignedToken));
    return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string) {
    // Generate local key
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Import Subscriber Key
    const subscriberKey = await crypto.subtle.importKey('raw', base64UrlDecode(p256dhKey).buffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);

    // HKDF Helpers
    const authSecretBytes = base64UrlDecode(authSecret);
    const prkKey = await crypto.subtle.importKey('raw', authSecretBytes.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, new Uint8Array(sharedSecret)));

    const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
    const cekKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cek = (new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...cekInfo, 1])))).slice(0, 16);

    const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
    const nonce = (new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...nonceInfo, 1])))).slice(0, 12);

    // Encrypt
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const padded = new Uint8Array([...new TextEncoder().encode(payload), 2]); // Padding: 2
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

    return { ciphertext, salt, localPublicKey };
}

// MAIN WORKER FUNCTION
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    // PRODUCTION CONFIG: 55s Loop (Long Polling)
    const MAX_DURATION_MS = 55 * 1000;
    const POLL_INTERVAL_MS = 10 * 1000;
    const START_TIME = Date.now();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[Worker] Starting 55s notification loop...');
    let iterations = 0;
    let totalSent = 0;

    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID Configuration Missing');

        // --- LOOP START ---
        while (Date.now() - START_TIME < MAX_DURATION_MS) {
            iterations++;
            console.log(`[Worker] Iteration ${iterations} at ${(Date.now() - START_TIME) / 1000}s`);

            // 1. Fetch Active Subscriptions
            const { data: subs, error: subError } = await supabase
                .from('stop_notification_subscriptions')
                .select('*')
                .not('stop_notifications', 'is', null);

            if (subError) throw subError;
            if (!subs || subs.length === 0) {
                console.log('[Worker] No subscriptions. Sleeping...');
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
                continue;
            }

            // 2. Group by StopId
            const stopsToCheck = new Set<string>();
            const subMap = new Map<string, any[]>(); // StopId -> Subs[]

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
            // Note: Parallel fetches for speed
            await Promise.all(Array.from(stopsToCheck).map(async (stopId) => {
                // FETCH MERGED ARRIVALS (Fusion Engine is in gtfs-proxy)
                // We ask for 'updates-only' if possible, but proxy doesn't support that yet.
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

                        // Thresholds: 10, 5, 2
                        // We check strictly.
                        // Ideally user settings has "beforeMinutes". 
                        // We interpret beforeMinutes=5 as "Alert at 5".
                        // Standard Logic: 10, 5, 2 if within settings.
                        const maxMins = Math.max(setting.beforeMinutes, 2);
                        const thresholds = [10, 5, 2].filter(t => t <= maxMins);

                        // Find the HIGHEST threshold we just crossed
                        // e.g. minsUntil = 4.  Thresholds [10, 5, 2]. 
                        // We qualify for 5. (But maybe 2 later).
                        // We want to send the "5 min alert".
                        // Check if we ALREADY sent "5" or "2" (any lower/equal priority).

                        let targetAlertLevel: number | null = null;
                        for (const t of thresholds) {
                            if (minsUntil <= t) {
                                targetAlertLevel = t;
                                break; // Found the highest applicable alert (e.g. 5)
                            }
                        }

                        if (!targetAlertLevel) continue; // Bus too far (e.g. 15 mins)

                        // --- STRICT STATE MACHINE CHECK ---
                        // Check logic: Has this subscription ALREADY received an alert <= targetAlertLevel for THIS bus (approx)?
                        // Since we don't have unique trip_id reliably from all feeds, we use a Time Window.
                        // "Have we sent an alert <= 5 for route X in last 20 mins?"

                        const { data: logs } = await supabase
                            .from('notifications_log')
                            .select('alert_level, sent_at')
                            .eq('subscription_id', sub.id)
                            .eq('route_id', routeId)
                            .gt('sent_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
                            .lte('alert_level', targetAlertLevel); // Already sent this OR a more urgent alert

                        if (logs && logs.length > 0) {
                            // Already handled. Skip.
                            continue;
                        }

                        // --- SEND PUSH ---
                        const urgency = minsUntil <= 2 ? '🚨' : '🚌';
                        const sourceIcon = arrival.source === 'siri' ? '📡' : '';
                        const payload = JSON.stringify({
                            title: `${urgency} Bus ${routeName} arriving in ${minsUntil}'`,
                            body: `Reaching ${setting.stopName} soon. ${sourceIcon}`,
                            icon: '/pwa-192x192.png',
                            data: { url: `/?stop=${stopId}` }
                        });

                        try {
                            // Construct endpoint URL properly
                            const endpointUrl = new URL(sub.endpoint);
                            const aud = `${endpointUrl.protocol}//${endpointUrl.hostname}`;
                            const jwt = await createVapidJwt(aud, 'mailto:admin@motionbus.cy', VAPID_PRIVATE_KEY);
                            const { ciphertext, salt, localPublicKey } = await encryptPayload(payload, sub.p256dh, sub.auth);

                            // WebPush Body Format
                            const body = new Uint8Array([...salt, 0, 0, 16, 0, 65, ...localPublicKey, ...ciphertext]);

                            await fetch(sub.endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/octet-stream',
                                    'Content-Encoding': 'aes128gcm',
                                    'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
                                    'TTL': '60'
                                },
                                body
                            });

                            console.log(`[Worker] Push Sent: Sub ${sub.id.slice(0, 4)} Route ${routeId} @ ${minsUntil}m`);
                            totalSent++;

                            // --- LOG STATE ---
                            await supabase.from('notifications_log').insert({
                                subscription_id: sub.id,
                                stop_id: stopId,
                                route_id: routeId,
                                alert_level: targetAlertLevel
                            });

                        } catch (err) {
                            console.error('Push Failed:', err);
                            // If 410, delete sub logic here (omitted for brevity)
                        }
                    }
                }
            }));

            // SLEEP REST OF INTERVAL
            const elapsed = Date.now() - START_TIME;
            if (elapsed > MAX_DURATION_MS) break;
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
        // --- LOOP END ---

        return new Response(JSON.stringify({ status: 'ok', iterations, totalSent }), { headers: corsHeaders });

    } catch (e) {
        console.error('[Worker] Fatal:', e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
    }
});
