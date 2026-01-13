const crypto = require('crypto').webcrypto || globalThis.crypto;
const fs = require('fs');

const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

const encoder = new TextEncoder();

function b64u(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64d(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return new Uint8Array(Buffer.from(str, 'base64'));
}

async function hmac(key, data) {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// Fixed HKDF-Expand specifically for Web Push encryption
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

    // RFC 8291 Section 4 extraction
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

async function send(sub, payload = null) {
    const jwt = await (async () => {
        const h = b64u(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
        const aud = new URL(sub.endpoint).origin;
        const p = b64u(encoder.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 3600, sub: 'mailto:admin@motionbus.cy' })));
        const unsigned = `${h}.${p}`;
        const key = await crypto.subtle.importKey("jwk", {
            kty: "EC", crv: "P-256", ext: true,
            x: b64u(b64d(VAPID_PUB).slice(1, 33)), y: b64u(b64d(VAPID_PUB).slice(33, 65)), d: b64u(b64d(VAPID_PRIV))
        }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
        const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned));
        return `${unsigned}.${b64u(sig)}`;
    })();

    const headers = {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
        'TTL': '3600',
        'Urgency': 'high'
    };

    let body = null;
    if (payload) {
        headers['Content-Encoding'] = 'aes128gcm';
        headers['Content-Type'] = 'application/octet-stream';
        body = await encrypt(payload, sub.p256dh, sub.auth);
    }

    const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
    return res.status;
}

async function run() {
    // TARGET: FRESH b04ad04f (11:15 Local)
    const sub = {
        id: "b04ad04f",
        endpoint: "https://web.push.apple.com/QKGUa2YX4QZTYilm32LgSLlfQbttyZw0tMsivQESdBcQdQDBgCsr5Y1rxcgjxltyIDegzZ4zdoP8SWYfL7Qi1XlSauEoNoYqhWnvTfnaqpkKHBtkXA2mwE1A5A-nQsmjLBY8xIbM_I7OY9ufqRGMhBvj8BUT16HMgZq8rtOQlZo",
        p256dh: "BN3OLUd51Mh+0f3is8I0UZR6Lg7spDSfBvlpYZbG1AzHCYC2IkhhKbHzifGpAYw0dyPIX1+4y6EUN4N3JUrMH6s=",
        auth: "jIdjTLRcr0kSgVc3/uEYqQ=="
    };

    console.log(`\n--- STARTING FRESH TEST FOR SUBSCRIPTION ${sub.id} ---`);

    console.log("Step 1: Sending PING (Diagnostic)...");
    const s1 = await send(sub);
    console.log("Ping Status:", s1);

    console.log("Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Step 2: Sending ENCRYPTED (Real Payload)...");
    const s2 = await send(sub, JSON.stringify({
        notification: {
            title: "Motion Bus Live",
            body: "Great news! This message arrived on your fresh install. 🚌💎",
            data: { url: "/MotionAG/" }
        }
    }));
    console.log("Encrypted Status:", s2);

    console.log("--- TEST COMPLETE ---");
}

run().catch(e => console.log(e));
