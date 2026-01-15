const fs = require('fs');
const crypto = require('crypto').webcrypto || globalThis.crypto;

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
        const targets = [
            {
                "name": "Live iPhone from DB (Z0kg)",
                "endpoint": "https://web.push.apple.com/QHDj-PSfTZkPo4k2gK3zqSbHALN_Iemx5Ul6To3kdPV2ypG5Z6mRPCveMd644RWu1TeHJdjDttdNdZL6dMljdCUonDcRPss3sHjbMf3tiRrg2QlMFhkB54PRyUMVMnSoasXPWi65I7wrHq2Lqg4AYU2-6nchy93rF45J0EWZ0kg",
                "auth": "NOTXD_f9NKf9l_ZmE1Bt7A",
                "p256dh": "BNT52NRKVIZFNI6KmWX-0jwmo6ih_sYr7lp153tPq1CCZ6BQNbdal1dtbehwrD5QQzXZa6lqA0ucEFZrNS6D6zA"
            },
            {
                "name": "Latest Android (v1.5.17.4)",
                "endpoint": "https://fcm.googleapis.com/fcm/send/fzLSNA1Hb-E:APA91bFunD7hflPVFH2RYRNkAYGpaJRKlAmzCQFEka6PxYCcQZ4nu6T9czXXXPwRfhQ-coSP5fsgD8K3nefWuAnTlRpvtKakT3mWxaYI6hOEQCwn0vVsIyduWtZR_V0RX7v3myWj0XM5",
                "auth": "PnCF3S7z3cfl1vh0gXjeNA",
                "p256dh": "BOZB2MkxvjwAPDooTz7FmiaoEPB2DYAnmwp6h0qB3J2CrvMBt6LOJMoqzlgm-Dul0suEfyIGh7q3rbSBvebMjgY"
            },
            {
                "name": "Active Android (Stop 2793)",
                "endpoint": "https://fcm.googleapis.com/fcm/send/diHE6U81yo8:APA91bGCtnh_d1qS4d49HRL7xa_v3_otgqYKYomWUFYZSIByvGXs5IdnpjWSra4fGLM7q3Kx4htF3Qz-rigGtJYgDG0536FMP-DGSaQyXdljxhvqF1a7iQuT-sTJFzFM99E4WQKRJ-PI",
                "auth": "KVEfHDhtkR9HaX7dDH3QBA==",
                "p256dh": "BFBtC2unbK6r41k84Tc+QbbSNce/wySGFUailbFT1fn7qzQfB4k9/C9rlwAL7BQJpUfr6AE2AOhZ7OofC0V4tKA="
            }
        ];

        const pushPayload = JSON.stringify({
            title: "SYSTEM ONLINE ✅",
            body: "Verification push successful. v1.5.17.7 Active.",
            icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
            tag: "sys-ok-" + Math.floor(Date.now() / 1000)
        });

        const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
        const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

        for (const target of targets) {
            console.log("\n---------------------------");
            console.log("Sending to:", target.name);
            const aud = new URL(target.endpoint).origin;
            const jwt = await createVapidJwt(aud, 'mailto:info@motionbus.cy', VAPID_PUB, VAPID_PRIV);
            const { ciphertext, salt, localPub } = await encryptPayload(pushPayload, target.p256dh, target.auth);

            const bodyLen = 16 + 4 + 1 + localPub.length + ciphertext.length;
            const body = new Uint8Array(bodyLen);
            let p = 0;
            body.set(salt, p); p += 16;
            body.set([0, 0, 16, 0], p); p += 4;
            body.set([localPub.length], p); p += 1;
            body.set(localPub, p); p += localPub.length;
            body.set(ciphertext, p);

            try {
                const resp = await fetch(target.endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                        'Content-Encoding': 'aes128gcm',
                        'TTL': '60',
                        'Urgency': 'high'
                    },
                    body: body
                });
                console.log("Response:", resp.status);
                if (resp.status !== 201) {
                    console.log(await resp.text());
                }
            } catch (e) { console.log(e.message); }
        }

    } catch (e) {
        console.error(e);
    }
})();
