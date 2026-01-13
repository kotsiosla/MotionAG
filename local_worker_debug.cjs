const crypto = require('crypto').webcrypto || globalThis.crypto;

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

async function createJwt(aud) {
    const h = b64u(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
    const p = b64u(encoder.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 3600, sub: 'mailto:admin@motionbus.cy' })));
    const unsigned = `${h}.${p}`;
    const pub = b64d(VAPID_PUB);
    const priv = b64d(VAPID_PRIV);
    const key = await crypto.subtle.importKey("jwk", {
        kty: "EC", crv: "P-256", ext: true,
        x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: b64u(priv)
    }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned));
    return `${unsigned}.${b64u(sig)}`;
}

async function encrypt(payload, p256dhB64, authB64) {
    const p256dh = b64d(p256dhB64);
    const auth = b64d(authB64);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const lKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const lPub = new Uint8Array(await crypto.subtle.exportKey('raw', lKey.publicKey));
    const rPub = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ss = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: rPub }, lKey.privateKey, 256));

    // 1. PRK = HKDF-Extract(salt=auth, IKM=sharedSecret)
    const ikmK = await crypto.subtle.importKey('raw', auth, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', ikmK, ss));
    const prkK = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    // 2. PRK_info = HKDF-Expand(PRK, Info, 32)
    const info = new Uint8Array([
        ...encoder.encode('WebPush: info\0'),
        ...p256dh,
        ...lPub
    ]);
    const infoKeyBuf = new Uint8Array(await crypto.subtle.sign('HMAC', prkK, new Uint8Array([...info, 1])));
    const infoKey = await crypto.subtle.importKey('raw', infoKeyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    // 3. CEK = HKDF-Expand(PRK_info, "Content-Encoding: aes128gcm\0", 16)
    const cek = (new Uint8Array(await crypto.subtle.sign('HMAC', infoKey, new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm\0'), 1])))).slice(0, 16);

    // 4. Nonce = HKDF-Expand(PRK_info, "Content-Encoding: nonce\0", 12)
    const non = (new Uint8Array(await crypto.subtle.sign('HMAC', infoKey, new Uint8Array([...encoder.encode('Content-Encoding: nonce\0'), 1])))).slice(0, 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: non }, aesKey, new Uint8Array([...encoder.encode(payload), 2]));

    const res = new Uint8Array(salt.length + 4 + 1 + lPub.length + ciphertext.byteLength);
    let o = 0;
    res.set(salt, o); o += salt.length;
    res.set([0, 0, 16, 0], o); o += 4;
    res.set([lPub.length], o); o += 1;
    res.set(lPub, o); o += lPub.length;
    res.set(new Uint8Array(ciphertext), o);
    return res;
}

async function run() {
    const sub = {
        id: "fb0e16e0-f7bc-4c85-877d-ba3c61959355",
        endpoint: "https://web.push.apple.com/QFH74coNDJQE28-XW1rdabk_KBRStwbVlXZdN5jJjojh2kf_DuSab7LFr78tcPoqUFuno3M1zhvvKuh00Klp6HYfzlhBkhHDFTw5sVrtpcwjGv5s62LoPhCrXMmzGlTMxHmal8rQcoLZ1i43yFpA0agkXj7JxdsqFs_GodTo0NU",
        p256dh: "BB5yk3ohPz33xqzSTESG+SEqY9rxQlzsM/DSYfcmzzDD25d/gJIAGb7gsMlLsGmJcF/cib161jE7qC28aQzOU5A=",
        auth: "Vgsl87Zaa4r/PiX+XQDdUQ=="
    };

    console.log(`POLLING REAL PAYLOAD (RFC 8291 Section 4)...`);
    const payload = JSON.stringify({
        notification: {
            title: "Motion Bus Live",
            body: "Great news! This message is now encrypted. 🚌✨",
            data: { url: "https://kotsiosla.github.io/MotionAG/" }
        }
    });

    const jwt = await createJwt(new URL(sub.endpoint).origin);
    const body = await encrypt(payload, sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
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

    console.log(`Apple Status: ${res.status}`);
}

run().catch(e => console.log(e));
