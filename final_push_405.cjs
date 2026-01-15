const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// CONFIG (Parity with Edge Function)
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw";

const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";
const FROM_EMAIL = 'mailto:admin@motionbus.cy';

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
    const payload = { aud, exp: now + 43200, sub };
    const unsigned = base64UrlEncode(Buffer.from(JSON.stringify(header))) + '.' + base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const pubBytes = base64UrlDecode(pub);
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));
    const key = await crypto.subtle.importKey('jwk', { kty: "EC", crv: "P-256", x, y, d: priv, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(unsigned));
    return unsigned + '.' + base64UrlEncode(new Uint8Array(sig));
}

async function encryptPayload(payloadStr, p256dh, auth) {
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const userKeyBytes = base64UrlDecode(p256dh);
    const subscriberKey = await crypto.subtle.importKey('raw', userKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);
    const authBytes = base64UrlDecode(auth);
    const prkKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', prkKey, sharedSecret);
    const infoBuffer = Buffer.from("Content-Encoding: aes128gcm\0");
    const inputBuffer = Buffer.concat([salt, infoBuffer, Buffer.from([1])]);
    const cekKeyImport = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cek = (await crypto.subtle.sign('HMAC', cekKeyImport, inputBuffer)).slice(0, 16);
    const nonceInfo = Buffer.from("Content-Encoding: nonce\0");
    const nonceInput = Buffer.concat([salt, nonceInfo, Buffer.from([1])]);
    const nonce = (await crypto.subtle.sign('HMAC', cekKeyImport, nonceInput)).slice(0, 12);
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const plaintext = Buffer.concat([Buffer.from(payloadStr), Buffer.from([2])]); // aes128gcm padding
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);
    return { ciphertext: new Uint8Array(ciphertext), salt, localPub };
}

async function run() {
    console.log("FINAL PARITY TEST (Wrapped + Lowercase Headers)...");

    // Get newest sub (FRESH CONNECTION)
    let { data: pushSubs } = await supabase.from('push_subscriptions').select('*').order('created_at', { ascending: false }).limit(1);
    if (!pushSubs || pushSubs.length === 0) return console.error("No subs found.");

    const target = pushSubs[0];
    console.log(`Targeting FRESH: ...${target.endpoint.slice(-10)}`);

    // WRAPPED PAYLOAD (Exact Edge Function Format)
    const payload = JSON.stringify({
        notification: {
            title: "🚌 Bus 405 in 4'",
            body: "Final Test (v2.0.5 Parity)",
            icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
            badge: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
            requireInteraction: true,
            data: {
                url: "https://kotsiosla.github.io/MotionAG/?route=405",
                logUrl: SUPABASE_URL,
                logKey: ANON_KEY,
                stopId: "341",
                tripId: "405-FINAL"
            }
        }
    });

    try {
        const aud = new URL(target.endpoint).origin;
        const jwt = await createVapidJwt(aud, FROM_EMAIL, VAPID_PUB, VAPID_PRIV);
        const { ciphertext, salt, localPub } = await encryptPayload(payload, target.p256dh, target.auth);

        const body = new Uint8Array(16 + 4 + 1 + localPub.length + ciphertext.length);
        let off = 0;
        body.set(salt, off); off += 16;
        body.set([0, 0, 16, 0], off); off += 4;
        body.set([localPub.length], off); off += 1;
        body.set(localPub, off); off += localPub.length;
        body.set(ciphertext, off);

        console.log("Sending with LOWERCASE headers (Exact Edge Parity)...");
        const resp = await fetch(target.endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/octet-stream',
                'content-encoding': 'aes128gcm',
                'authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                'ttl': '3600',
                'urgency': 'high'
            },
            body
        });

        console.log(`>> Status: ${resp.status}`);
        if (resp.status === 201) {
            console.log("✅ SUCCESS: Apple accepted. Please check iPhone.");

            // Log manually as the script won't be seen by backend logic
            await supabase.from('notifications_log').insert({
                stop_id: "341",
                route_id: "405-FINAL",
                alert_level: 1,
                metadata: { status_code: 201, push_success: true, step: 'MANUAL_TRIGGER' }
            });
        } else {
            console.log(await resp.text());
        }
    } catch (e) { console.error("Error:", e.message); }
}

run();
