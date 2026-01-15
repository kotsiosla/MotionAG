const fs = require('fs');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// Keys from keys_dump.json
const TARGET = {
    "endpoint": "https://web.push.apple.com/QOqQV-1SCPRo_q28idbiQpjkncTl2qvq8sqiLFOX4NyjkK696rjp99QNW5gNz5dSBpQeyj_WWcWlrlpWkmjgKVE5G0md4poYocx44LsF-M9NnTCjiIEBuye1MSSVp-HNMK-a3jZS-VXAu01T5aoa8D9u136y_V3QyoJnJHM0xpE",
    "auth": "thLIO3B4QunZ19gKXYb03A",
    "p256dh": "BJcY8ssflu-JNzmtex_AZm83of31WLbvEbec0RMbB5A_0Dn3VZukju0GRegj3FCIbjxiWsYboeWFRaxuyMYTCiU"
};

const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

// Helper: Base64URL
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
    const payload = { aud: aud, exp: now + 43200, sub: sub };
    const unsigned = base64UrlEncode(Buffer.from(JSON.stringify(header))) + '.' + base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const pubBytes = base64UrlDecode(pub);
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));
    const key = await crypto.subtle.importKey('jwk', { kty: "EC", crv: "P-256", x: x, y: y, d: priv, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
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
    const payloadBytes = Buffer.from(payloadStr);
    const plaintext = Buffer.concat([payloadBytes, Buffer.from([2])]);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);
    return { ciphertext: new Uint8Array(ciphertext), salt, localPub };
}

(async () => {
    try {
        const payload = JSON.stringify({
            notification: {
                title: "🚨 MANUAL ALARM TEST",
                body: "This is a manual trigger to verify functionality.",
                icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
                badge: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
                vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
                requireInteraction: true,
                data: {
                    url: "https://kotsiosla.github.io/MotionAG/?stop=2878",
                    stopId: "2878"
                }
            }
        });

        console.log("Sending manual push to:", TARGET.endpoint.slice(0, 30) + "...");

        const aud = new URL(TARGET.endpoint).origin;
        const jwt = await createVapidJwt(aud, 'mailto:info@motionbus.cy', VAPID_PUB, VAPID_PRIV);
        const { ciphertext, salt, localPub } = await encryptPayload(payload, TARGET.p256dh, TARGET.auth);

        const bodyLen = 16 + 4 + 1 + localPub.length + ciphertext.length;
        const body = new Uint8Array(bodyLen);
        let p = 0;
        body.set(salt, p); p += 16;
        body.set([0, 0, 16, 0], p); p += 4;
        body.set([localPub.length], p); p += 1;
        body.set(localPub, p); p += localPub.length;
        body.set(ciphertext, p);

        const resp = await fetch(TARGET.endpoint, {
            method: 'POST',
            headers: {
                'authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                'content-encoding': 'aes128gcm',
                'ttl': '3600',
                'urgency': 'high'
            },
            body: body
        });

        console.log("Response:", resp.status);
        if (resp.status !== 201) {
            console.log(await resp.text());
        }

    } catch (e) {
        console.error(e);
    }
})();
