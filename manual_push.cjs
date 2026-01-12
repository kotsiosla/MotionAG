const fs = require('fs');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// Helper: Base64URL
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function base64UrlEncode(data) {
    let result = "";
    let i = 0;
    const len = data.length;
    for (; i < len; i += 3) {
        const b1 = data[i];
        const b2 = i + 1 < len ? data[i + 1] : 0;
        const b3 = i + 2 < len ? data[i + 2] : 0;
        const trip = (b1 << 16) | (b2 << 8) | b3;
        result += B64_CHARS[(trip >> 18) & 0x3F] + B64_CHARS[(trip >> 12) & 0x3F] +
            (i + 1 < len ? B64_CHARS[(trip >> 6) & 0x3F] : "") + (i + 2 < len ? B64_CHARS[trip & 0x3F] : "");
    }
    return result;
}
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4 !== 0) str += '=';
    return Buffer.from(str, 'base64');
}

// VAPID
async function createVapidJwt(aud, sub, pub, priv) {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: aud, exp: now + 43200, sub: sub };
    const unsigned = base64UrlEncode(Buffer.from(JSON.stringify(header))) + '.' + base64UrlEncode(Buffer.from(JSON.stringify(payload)));

    // Import Private Key (JWK)
    // Convert pub/priv to JWK components
    const pubBytes = base64UrlDecode(pub);
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));

    const key = await crypto.subtle.importKey(
        'jwk',
        { kty: "EC", crv: "P-256", x: x, y: y, d: priv, key_ops: ['sign'], ext: true },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(unsigned));
    return unsigned + '.' + base64UrlEncode(new Uint8Array(sig));
}

// Encrypt
async function encryptPayload(payloadStr, p256dh, auth) {
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const userKeyBytes = base64UrlDecode(p256dh);
    const subscriberKey = await crypto.subtle.importKey('raw', userKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);

    const authBytes = base64UrlDecode(auth);
    const prkKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', prkKey, sharedSecret); // IKM for HKDF

    // HKDF Expand (Info: Content-Encoding: aes128gcm\0)
    const cekInfo = Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])]); // Need salt? No, derive cek first?
    // Wait, standard WebPush HKDF uses salt + info.
    // crypto.ts logic: sign(HMAC, cekKey, [...salt, ...cekInfo, 1])

    const cekKeyImport = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    // CEK
    const cekInput = new Uint8Array(16 + cekInfo.length);
    cekInput.set(salt);
    cekInput.set(cekInfo, 16); // wait, cekInfo included \0? yes. And trailing 1?
    // Logic from crypto.ts: [...salt, ...cekInfo, 1]
    // cekInfo was "Content...gcm\0". 
    // And 1 is appended.
    // So buffer construction:
    const infoBuffer = Buffer.from("Content-Encoding: aes128gcm\0");
    const inputBuffer = Buffer.concat([salt, infoBuffer, Buffer.from([1])]);
    const cek = (await crypto.subtle.sign('HMAC', cekKeyImport, inputBuffer)).slice(0, 16);

    // NONCE
    const nonceInfo = Buffer.from("Content-Encoding: nonce\0");
    const nonceInput = Buffer.concat([salt, nonceInfo, Buffer.from([1])]);
    const nonce = (await crypto.subtle.sign('HMAC', cekKeyImport, nonceInput)).slice(0, 12);

    // Encrypt
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const padding = new Uint8Array(2); // Padding length? No, usually content + padding.
    // RFC8188: padding delimiter 2 (0x02) if no padding? Or 0x01 then 0x00?
    // crypto.ts used: [...payload, 2]. 2 bytes? No, number 2.
    // Let's deduce. record size?
    // Padding: 2 usually means 0x02 byte appended.
    const payloadBytes = Buffer.from(payloadStr);
    const plaintext = Buffer.concat([payloadBytes, Buffer.from([2])]);

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);
    return { ciphertext: new Uint8Array(ciphertext), salt, localPub };
}

(async () => {
    try {
        const payloadJson = JSON.parse(fs.readFileSync('payload_fixed.json', 'utf8'))[0];
        const pushPayload = JSON.stringify({ title: "TEST NOTIFICATION", body: "Manual Send from Node", icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png" });

        // Keys (Hardcoded fallback matched)
        const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
        const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

        console.log("Creating JWT...");
        const endpoint = payloadJson.endpoint;
        const aud = new URL(endpoint).origin;
        const jwt = await createVapidJwt(aud, 'mailto:admin@test.com', VAPID_PUB, VAPID_PRIV);

        console.log("Encrypting...");
        const { ciphertext, salt, localPub } = await encryptPayload(pushPayload, payloadJson.p256dh, payloadJson.auth);

        // Header
        // Authorization: vapid t=jwt, k=pub
        // Content-Encoding: aes128gcm
        // Body: salt (16) + rec_size (4) + len_pub (1) + pub + ciphertext
        const bodyLen = 16 + 4 + 1 + localPub.length + ciphertext.length;
        const body = new Uint8Array(bodyLen);
        let p = 0;
        body.set(salt, p); p += 16;
        body.set([0, 0, 16, 0], p); p += 4; // Record size (4096)
        body.set([localPub.length], p); p += 1;
        body.set(localPub, p); p += localPub.length;
        body.set(ciphertext, p);

        console.log("Sending to:", endpoint);
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                'Content-Encoding': 'aes128gcm',
                'TTL': '60'
            },
            body: body
        });

        console.log("Response:", resp.status, await resp.text());

    } catch (e) {
        console.error(e);
    }
})();
