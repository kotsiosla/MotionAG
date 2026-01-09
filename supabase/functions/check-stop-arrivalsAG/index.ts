import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StopNotificationSettings {
    stopId: string;
    stopName: string;
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    voice: boolean;
    push: boolean;
    beforeMinutes: number;
}

interface StopSubscription {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    stop_notifications: StopNotificationSettings[];
    last_notified: Record<string, number>;
}

// Base64url encode/decode utilities
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

// Create VAPID JWT token
async function createVapidJwt(
    audience: string,
    subject: string,
    privateKeyBase64: string
): Promise<string> {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        aud: audience,
        exp: now + 86400,
        sub: subject,
    };

    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Import private key for signing
    const privateKeyBytes = base64UrlDecode(privateKeyBase64);

    // PKCS8 header for P-256 private key
    const pkcs8Header = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
        0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
        0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
    ]);

    const pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyBytes]);

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        pkcs8Key,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );

    const rawSig = new Uint8Array(signature);
    return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

// Encrypt payload using ECDH and AES-GCM
async function encryptPayload(
    payload: string,
    p256dhKey: string,
    authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
    // Generate local key pair
    const localKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // Export local public key
    const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
    const localPublicKey = new Uint8Array(localPublicKeyRaw);

    // Import subscriber's public key
    const subscriberKeyBytes = base64UrlDecode(p256dhKey);
    const subscriberPublicKey = await crypto.subtle.importKey(
        'raw',
        subscriberKeyBytes.buffer as ArrayBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: subscriberPublicKey },
        localKeyPair.privateKey,
        256
    );

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const authSecretBytes = base64UrlDecode(authSecret);

    // Derive encryption key using HKDF
    const ikm = new Uint8Array(sharedSecret);

    // PRK = HKDF-Extract(auth_secret, shared_secret)
    const prkKey = await crypto.subtle.importKey(
        'raw',
        authSecretBytes.buffer as ArrayBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, ikm));

    // Create info for content encryption key
    const keyInfoStr = 'Content-Encoding: aes128gcm\0';
    const keyInfo = new TextEncoder().encode(keyInfoStr);

    // Derive content encryption key
    const cekKey = await crypto.subtle.importKey(
        'raw',
        prk,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const cekMaterial = new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...keyInfo, 1])));
    const cek = cekMaterial.slice(0, 16);

    // Derive nonce
    const nonceInfoStr = 'Content-Encoding: nonce\0';
    const nonceInfo = new TextEncoder().encode(nonceInfoStr);
    const nonceMaterial = new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...nonceInfo, 1])));
    const nonce = nonceMaterial.slice(0, 12);

    // Encrypt with AES-GCM
    const aesKey = await crypto.subtle.importKey(
        'raw',
        cek,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    // Add padding delimiter
    const payloadBytes = new TextEncoder().encode(payload);
    const paddedPayload = new Uint8Array([...payloadBytes, 2]); // 2 = final record

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        aesKey,
        paddedPayload
    );

    return {
        ciphertext: new Uint8Array(encrypted),
        salt,
        localPublicKey,
    };
}

// Send push notification
async function sendPushNotification(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    try {
        const url = new URL(endpoint);
        console.log(`Sending push to: ${url.hostname}`);

        // Create VAPID authorization
        const audience = `${url.protocol}//${url.hostname}`;
        const vapidToken = await createVapidJwt(audience, 'mailto:info@motionbus.cy', vapidPrivateKey);

        // Encrypt the payload
        const { ciphertext, salt, localPublicKey } = await encryptPayload(payload, p256dh, auth);

        // Build body with aes128gcm format
        const rs = new Uint8Array([0, 0, 16, 0]); // Record size: 4096
        const idlen = new Uint8Array([65]); // Key ID length

        const body = new Uint8Array([
            ...salt,
            ...rs,
            ...idlen,
            ...localPublicKey,
            ...ciphertext,
        ]);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Encoding': 'aes128gcm',
                'TTL': '86400',
                'Urgency': 'high',
                'Authorization': `vapid t=${vapidToken}, k=${vapidPublicKey}`,
            },
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
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            console.error('VAPID keys not configured');
            return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('VAPID keys loaded successfully');

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get all subscriptions with stop notifications
        console.log('Fetching subscriptions from stop_notification_subscriptions...');
        const { data: subscriptions, error: subError } = await supabase
            .from('stop_notification_subscriptions')
            .select('*')
            .not('stop_notifications', 'is', null);

        if (subError) {
            console.error('Error fetching subscriptions:', subError);
            console.error('Error details:', JSON.stringify(subError, null, 2));
            return new Response(JSON.stringify({ error: 'Database error', details: subError }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`Found ${subscriptions?.length || 0} subscriptions (before filtering)`);

        // Debug: Log all subscriptions
        if (subscriptions && subscriptions.length > 0) {
            subscriptions.forEach((sub, idx) => {
                console.log(`Subscription ${idx + 1}:`, {
                    id: sub.id,
                    endpoint: sub.endpoint?.substring(0, 50) + '...',
                    stop_notifications_count: Array.isArray(sub.stop_notifications) ? sub.stop_notifications.length : 'not array',
                    stop_notifications: Array.isArray(sub.stop_notifications) ? sub.stop_notifications.map((s: any) => ({
                        stopId: s?.stopId,
                        stopName: s?.stopName,
                        enabled: s?.enabled,
                        push: s?.push,
                        beforeMinutes: s?.beforeMinutes
                    })) : sub.stop_notifications
                });
            });
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('No stop notification subscriptions found');
            // Also check if there are any subscriptions at all (even without stop_notifications)
            const { data: allSubs } = await supabase
                .from('stop_notification_subscriptions')
                .select('id, endpoint, stop_notifications');
            console.log(`Total subscriptions in table (including null): ${allSubs?.length || 0}`);
            if (allSubs && allSubs.length > 0) {
                allSubs.forEach((sub, idx) => {
                    console.log(`All subscription ${idx + 1}:`, {
                        id: sub.id,
                        endpoint: sub.endpoint?.substring(0, 50) + '...',
                        has_stop_notifications: !!sub.stop_notifications,
                        stop_notifications_type: typeof sub.stop_notifications,
                        stop_notifications_is_array: Array.isArray(sub.stop_notifications),
                        stop_notifications_length: Array.isArray(sub.stop_notifications) ? sub.stop_notifications.length : 'N/A'
                    });
                });
            }
            return new Response(JSON.stringify({ checked: 0, sent: 0, debug: { totalInTable: allSubs?.length || 0 } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Group subscriptions by Stop ID to minimize requests
        const stopSubscriptions: Record<string, StopSubscription[]> = {};

        for (const sub of subscriptions as StopSubscription[]) {
            const stopSettings = sub.stop_notifications || [];
            const enabledSettings = Array.isArray(stopSettings)
                ? stopSettings.filter(s => s && s.enabled && s.push)
                : [];

            for (const setting of enabledSettings) {
                if (!stopSubscriptions[setting.stopId]) {
                    stopSubscriptions[setting.stopId] = [];
                }
                // Avoid adding the same subscription multiple times for the same stop
                if (!stopSubscriptions[setting.stopId].find(s => s.id === sub.id)) {
                    stopSubscriptions[setting.stopId].push(sub);
                }
            }
        }

        const stopIds = Object.keys(stopSubscriptions);
        console.log(`Checking arrivals for ${stopIds.length} unique stops`);

        // Process stops in batches to avoid overwhelming the proxy
        const CHUNK_SIZE = 5;
        const nowSeconds = Math.floor(Date.now() / 1000);
        let processedStops = 0; // This variable was declared but not initialized in the instruction, assuming it should be 0.
        const notificationsSent: string[] = [];

        for (let i = 0; i < stopIds.length; i += CHUNK_SIZE) {
            const chunk = stopIds.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (stopId) => {
                try {
                    // Fetch merged arrivals (GTFS + SIRI) for this stop
                    const arrivalResponse = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`, {
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        }
                    });

                    if (!arrivalResponse.ok) {
                        console.error(`Failed to fetch arrivals for stop ${stopId}: ${arrivalResponse.status}`);
                        return;
                    }

                    const arrivalData = await arrivalResponse.json();
                    const arrivals = arrivalData.data || [];

                    if (arrivals.length === 0) return;

                    // Check all subscriptions for this stop
                    const relevantSubs = stopSubscriptions[stopId];

                    for (const sub of relevantSubs) {
                        const settings = sub.stop_notifications.find(s => s.stopId === stopId);
                        if (!settings || !settings.enabled || !settings.push) continue;

                        const lastNotified = sub.last_notified || {};
                        let subUpdated = false;

                        for (const arrival of arrivals) {
                            // Match route (handle potential mismatches in ID format)
                            // Notification settings might save "8040012", arrival might be "0012" or vice versa
                            // We should ideally check if one contains the other or strict match if possible
                            // For now, we rely on the specific Route ID saved in settings. 
                            // NOTE: Ideally we should use route short name matching too but settings don't strictly have it.
                            // WE will check if arrival.routeId matches settings (which is implicitly what we want)
                            // But wait, the user subscribes to a specific Route at a Stop.
                            // Does the setting store RouteID?
                            // StopNotificationSettings interface from Line 9:
                            // stopId, stopName, enabled... BEFORE MINUTES.
                            // IT DOES NOT FILTER BY ROUTE ID! 
                            // Wait, Stop Notifications are usually "Notify me for ANY bus at this stop" ???
                            // Let's check the Interface again.

                            // Interface StopNotificationSettings (Line 9):
                            // stopId, stopName, enabled...
                            // IT DOES NOT HAVE ROUTE ID.
                            // This means the user wants to be notified for ALL buses at this stop?
                            // OR is it "Watched Trips"?
                            // Line 15 (in useStopNotifications.ts) has 'watchedTrips?: string[]'.
                            // The interface in THIS file (Line 9) MISSES 'watchedTrips'.
                            // I need to update the interface too? 
                            // No, if the user wants ANY bus, then we notify for ANY arrival.
                            // If the user wants specific trips, we need that field.
                            // Assuming "Any Bus" for now based on current interface. 
                            // Wait, `check-stop-arrivals/index.ts` code I read earlier didn't check RouteID against settings. 
                            // It just iterated trips and checked `stuStopId === settings.stopId`.
                            // So yes, it notifies for ALL buses.

                            const arrivalTime = arrival.bestArrivalTime;
                            if (!arrivalTime) continue;

                            const routeId = arrival.routeId || 'unknown';
                            const routeName = arrival.routeShortName || routeId;

                            const secondsUntil = arrivalTime - nowSeconds;
                            const minutesUntil = Math.round(secondsUntil / 60);

                            // Progressive notifications: 5, 3, 2, 1
                            const notificationIntervals = [5, 3, 2, 1];
                            const maxBeforeMinutes = Math.max(settings.beforeMinutes, 5);

                            // Improved Logic (Stateful Catch-up)
                            let shouldNotify = false;
                            let notificationInterval = 0;
                            const baseNotifKey = `${settings.stopId}-${routeId}-${Math.floor(arrivalTime / 60)}`;

                            for (const interval of notificationIntervals) {
                                if (interval > maxBeforeMinutes) continue;

                                const intervalKey = `${baseNotifKey}-${interval}`;
                                const hasSentThisInterval = lastNotified[intervalKey] > 0;

                                if (!hasSentThisInterval && minutesUntil <= interval) {
                                    shouldNotify = true;
                                    notificationInterval = interval;
                                    // Keep checking smaller intervals to find the "tightest" one? 
                                    // Actually, iterating 5->1. 
                                    // If we are at 1 min.
                                    // 5 > 1 (True). Sent? No. Set interval=5.
                                    // 3 > 1 (True). Sent? No. Set interval=3.
                                    // ...
                                    // We want the most specific one.
                                    // The loop overwrites `notificationInterval`. 
                                    // So we end up with the smallest interval (1). 
                                    // Validate: "1" is the alert we want to send if we are at 1m.
                                    // Correct.
                                }
                            }

                            if (shouldNotify && notificationInterval > 0) {
                                // Prevent duplicate notifications within 30 seconds (global protection)
                                const intervalNotifKey = `${baseNotifKey}-${notificationInterval}`;
                                const lastNotifTime = lastNotified[intervalNotifKey] || 0;
                                if (nowSeconds - lastNotifTime < 30) continue;

                                try {
                                    const urgencyEmoji = minutesUntil <= 1 ? '🚨' : minutesUntil <= 2 ? '⚠️' : minutesUntil <= 3 ? '🔔' : '🚌';
                                    const urgencyText = minutesUntil <= 1 ? 'ΤΩΡΑ!' : minutesUntil <= 2 ? 'Σύντομα' : minutesUntil <= 3 ? 'Προσεχώς' : 'Ερχεται';

                                    const sourceIndicator = arrival.source === 'siri' ? '📡' : ''; // Indicate if using SIRI

                                    const payload = JSON.stringify({
                                        title: `${urgencyEmoji} ${routeName} ${urgencyText} - ${minutesUntil}' ${sourceIndicator}`,
                                        body: `Φτάνει στη στάση "${settings.stopName}"${minutesUntil <= 2 ? ' - Ετοιμάσου!' : ''}`,
                                        icon: '/pwa-192x192.png',
                                        url: `/?stop=${settings.stopId}`,
                                        tag: `arrival-${settings.stopId}-${routeId}-${notificationInterval}`,
                                        vibrate: minutesUntil <= 1 ? [300, 100, 300, 100, 300] : minutesUntil <= 2 ? [200, 100, 200, 100, 200] : [200, 100, 200],
                                        requireInteraction: minutesUntil <= 2,
                                        badge: '/pwa-192x192.png',
                                        timestamp: arrivalTime * 1000,
                                    });

                                    const result = await sendPushNotification(
                                        sub.endpoint,
                                        sub.p256dh,
                                        sub.auth,
                                        payload,
                                        VAPID_PUBLIC_KEY,
                                        VAPID_PRIVATE_KEY
                                    );

                                    if (result.success) {
                                        console.log(`✅ Push sent: stop ${settings.stopId}, route ${routeId}, ${minutesUntil} min (interval: ${notificationInterval})`);
                                        lastNotified[intervalNotifKey] = nowSeconds;
                                        notificationsSent.push(intervalNotifKey);
                                        subUpdated = true;
                                    } else {
                                        console.error('❌ Push error:', result.statusCode, result.error);
                                        if (result.statusCode === 410 || result.statusCode === 404) {
                                            await supabase.from('stop_notification_subscriptions').delete().eq('id', sub.id);
                                        }
                                    }
                                } catch (err) {
                                    console.error('Push handling error:', err);
                                }
                            }
                        }

                        if (subUpdated) {
                            await supabase
                                .from('stop_notification_subscriptions')
                                .update({ last_notified: lastNotified })
                                .eq('id', sub.id);
                        }
                    }

                } catch (e) {
                    console.error(`Error processing stop ${stopId}:`, e);
                }
            });

            await Promise.all(promises);
        }

        console.log(`Checked ${stopIds.length} stops, sent ${notificationsSent.length} notifications`);

        return new Response(JSON.stringify({
            checked: stopIds.length,
            sent: notificationsSent.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in check-stop-arrivals:', error);
        return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
