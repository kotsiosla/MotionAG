const fs = require('fs');
const https = require('https');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// CONFIG
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

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
    const key = await crypto.subtle.importKey('jwk', { kty: "EC", crv: "P-256", x: base64UrlEncode(pubBytes.slice(1, 33)), y: base64UrlEncode(pubBytes.slice(33, 65)), d: priv, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(unsigned));
    return unsigned + '.' + base64UrlEncode(new Uint8Array(sig));
}

async function encryptPayload(payloadStr, p256dh, auth) {
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // DEBUG KEY
    const kBytes = base64UrlDecode(p256dh);
    console.log(`[Crypto] Importing Peer Key: ${kBytes.length} bytes`);

    const subscriberKey = await crypto.subtle.importKey('raw', kBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);
    const authBytes = base64UrlDecode(auth);
    const prkKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', prkKey, sharedSecret);
    const infoBuffer = Buffer.from("Content-Encoding: aes128gcm\0");
    const cekKeyImport = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cek = (await crypto.subtle.sign('HMAC', cekKeyImport, Buffer.concat([salt, infoBuffer, Buffer.from([1])]))).slice(0, 16);
    const nonceInfo = Buffer.from("Content-Encoding: nonce\0");
    try {
        const nonce = (await crypto.subtle.sign('HMAC', cekKeyImport, Buffer.concat([salt, nonceInfo, Buffer.from([1])]))).slice(0, 12);
        const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
        const plaintext = Buffer.concat([Buffer.from(payloadStr), Buffer.from([2])]);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);
        return { ciphertext: new Uint8Array(ciphertext), salt, localPub };
    } catch (e) {
        throw new Error(`Encrypt error: ${e}`);
    }
}

async function sendPush(sub, payloadStr) {
    try {
        const aud = new URL(sub.endpoint).origin;
        const jwt = await createVapidJwt(aud, 'mailto:admin@test.com', VAPID_PUB, VAPID_PRIV);
        const { ciphertext, salt, localPub } = await encryptPayload(payloadStr, sub.p256dh, sub.auth);
        const bodyLen = 16 + 4 + 1 + localPub.length + ciphertext.length;
        const body = new Uint8Array(bodyLen);
        let p = 0;
        body.set(salt, p); p += 16;
        body.set([0, 0, 16, 0], p); p += 4;
        body.set([localPub.length], p); p += 1;
        body.set(localPub, p); p += localPub.length;
        body.set(ciphertext, p);

        const resp = await fetch(sub.endpoint, {
            method: 'POST',
            headers: { 'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`, 'Content-Encoding': 'aes128gcm', 'TTL': '60', 'Urgency': 'high' },
            body: body
        });
        const txt = await resp.text();
        console.log(`[Push] Sent to ${sub.endpoint.slice(0, 20)}... Status: ${resp.status} Body: ${txt}`);
        return resp.ok;
    } catch (e) { console.error("[Push] Error:", e); return false; }
}

async function fetchJson(url) {
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY } });
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    return await resp.json();
}

async function check() {
    console.log(`[${new Date().toISOString()}] Sending URGENT TEST...`);
    try {
        // Fetch raw sub for NEW ID
        const subs = await fetchJson(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.676de2a3-ba8d-4ace-93c4-78b6cf906186&select=*`);
        const targetSub = subs[0];

        if (!targetSub) {
            console.log("No RAW subscription found (676d...)");
            return;
        }

        console.log(`Targeting 676d... URGENT`);

        const payload = JSON.stringify({
            title: "Priority Test",
            body: "Urgency High Check",
            // icon: "/MotionAG/pwa-192x192.png" // Omitted for safety
        });

        const ok = await sendPush(targetSub, payload);
        if (ok) {
            console.log("Push Success!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
check();
