const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// CONFIG
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw";

const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Crypto Helpers
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function base64UrlEncode(data) {
    let result = ""; let i = 0; const len = data.length;
    for (; i < len; i += 3) {
        const b1 = data[i]; const b2 = i + 1 < len ? data[i + 1] : 0; const b3 = i + 2 < len ? data[i + 2] : 0;
        const trip = (b1 << 16) | (b2 << 8) | b3;
        result += B64_CHARS[(trip >> 18) & 0x3F] + B64_CHARS[(trip >> 12) & 0x3F] + (i + 1 < len ? B64_CHARS[(trip >> 6) & 0x3F] : "") + (i + 2 < len ? B64_CHARS[trip & 0x3F] : "");
    }
    return result;
}
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4 !== 0) str += '=';
    return Buffer.from(str, 'base64');
}

async function createVapidJwt(aud, sub, pub, priv) {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud, exp: now + 3600, sub };
    const unsigned = base64UrlEncode(Buffer.from(JSON.stringify(header))) + '.' + base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const pubBytes = base64UrlDecode(pub);
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));
    const key = await crypto.subtle.importKey('jwk', { kty: "EC", crv: "P-256", x, y, d: priv, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(unsigned));
    return unsigned + '.' + base64UrlEncode(new Uint8Array(sig));
}

async function run() {
    console.log("DEBUG 2.1: SILENT PING TEST (No Payload)...");

    // Get newest sub
    let { data: pushSubs } = await supabase.from('push_subscriptions').select('*').order('created_at', { ascending: false }).limit(1);
    if (!pushSubs || pushSubs.length === 0) return console.error("No subs.");

    const target = pushSubs[0];
    console.log(`Targeting: ...${target.endpoint.slice(-10)}`);

    try {
        const aud = new URL(target.endpoint).origin;
        const jwt = await createVapidJwt(aud, 'mailto:admin@motionbus.cy', VAPID_PUB, VAPID_PRIV);

        const resp = await fetch(target.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                'TTL': '3600',
                'Urgency': 'high'
            }
        });

        console.log(`>> Status: ${resp.status}`);
        if (resp.status === 201) {
            console.log("✅ Ping accepted by Apple.");

            // Log to DB
            await supabase.from('notifications_log').insert({
                stop_id: "DEBUG-2.1",
                route_id: "PING-TEST",
                alert_level: 0,
                metadata: { step: 'SILENT_PING_SENT', version: 'debug-2.1', status_code: 201 }
            });
        } else {
            console.log(await resp.text());
        }
    } catch (e) { console.error("Error:", e.message); }
}

run();
