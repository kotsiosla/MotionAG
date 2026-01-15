const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// CONFIG
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";
const FROM_EMAIL = 'mailto:admin@motionbus.cy';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const encoder = new TextEncoder();
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (str) => {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return new Uint8Array(Buffer.from(str, 'base64'));
};

async function hmac(key, data) {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

async function hkdfExpand(prk, info, length) {
    const block = await hmac(prk, new Uint8Array([...info, 1]));
    return block.slice(0, length);
}

async function encrypt(payload, p256dhB64, authB64) {
    const p256dh = b64d(p256dhB64);
    const auth = b64d(authB64);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const lKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const lPub = new Uint8Array(await crypto.subtle.exportKey('raw', lKey.publicKey));
    const rPub = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ss = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: rPub }, lKey.privateKey, 256));

    // --- RFC 8291 Section 4 Extraction (MANDATORY FOR iOS) ---
    const prkIkm = await hmac(auth, ss);
    const infoWebPush = new Uint8Array([...encoder.encode('WebPush: info'), 0, ...p256dh, ...lPub]);
    const ikmWebPush = await hkdfExpand(prkIkm, infoWebPush, 32);

    // RFC 8188 Stage
    const prk = await hmac(salt, ikmWebPush);
    const cek = await hkdfExpand(prk, new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'), 0]), 16);
    const non = await hkdfExpand(prk, new Uint8Array([...encoder.encode('Content-Encoding: nonce'), 0]), 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const plaintext = new Uint8Array([...encoder.encode(payload), 2]); // LAST RECORD
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: non }, aesKey, plaintext);

    const body = new Uint8Array(16 + 4 + 1 + lPub.length + ciphertext.byteLength);
    let o = 0;
    body.set(salt, o); o += 16;
    const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
    body.set(rs, o); o += 4;
    body.set([lPub.length], o); o += 1;
    body.set(lPub, o); o += lPub.length;
    body.set(new Uint8Array(ciphertext), o);
    return body;
}

async function run() {
    console.log("SENDING RFC 8291 COMPLIANT TEST (Fixing Silent Banner)...");

    let { data: pushSubs } = await supabase.from('push_subscriptions').select('*').order('created_at', { ascending: false }).limit(1);
    if (!pushSubs || pushSubs.length === 0) return console.error("No subs.");

    const target = pushSubs[0];
    console.log(`Targeting: ...${target.endpoint.slice(-10)}`);

    const jwt = await (async () => {
        const h = b64u(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
        const aud = new URL(target.endpoint).origin;
        const p = b64u(encoder.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 3600, sub: FROM_EMAIL })));
        const unsigned = `${h}.${p}`;
        const key = await crypto.subtle.importKey("jwk", {
            kty: "EC", crv: "P-256", ext: true,
            x: b64u(b64d(VAPID_PUB).slice(1, 33)), y: b64u(b64d(VAPID_PUB).slice(33, 65)), d: b64u(b64d(VAPID_PRIV))
        }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
        const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned));
        return `${unsigned}.${b64u(sig)}`;
    })();

    const payload = JSON.stringify({
        notification: {
            title: "🚌 Last Test: Bus 405!",
            body: "Great! Confirmed! All systems operational.  ✅",
            data: { url: "/MotionAG/?route=405" }
        }
    });

    const body = await encrypt(payload, target.p256dh, target.auth);

    const res = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            'TTL': '3600',
            'Urgency': 'high'
        },
        body
    });

    console.log(`>> Status: ${res.status}`);
    if (res.status === 201) {
        console.log("✅ Success! Check iPhone for the Banner.");
        await supabase.from('notifications_log').insert({
            stop_id: "RFC8291",
            route_id: "405-FIXED",
            metadata: { step: 'FIXED_ENCRYPTION_SENT', status_code: 201 }
        });
    } else {
        console.log(await res.text());
    }
}

run().catch(e => console.log(e));
