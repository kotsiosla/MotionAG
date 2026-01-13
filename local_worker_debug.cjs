const fs = require('fs');
const https = require('https');
const crypto = require('crypto').webcrypto || globalThis.crypto;

// CONFIG
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

// ---------------------------------------------------------------
// Helper: base64url encode / decode
// ---------------------------------------------------------------
function base64urlEncode(buf) {
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = str.length % 4;
    if (pad) str += "=".repeat(4 - pad);
    const binary = atob(str);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) arr[i] = binary.charCodeAt(i);
    return arr;
}

// ---------------------------------------------------------------
// createVapidJwt – iOS‑safe
// ---------------------------------------------------------------
async function createVapidJwt(aud, sub, publicKeyBase64, privateKeyBase64) {
    const header = { alg: "ES256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud, exp: now + 12 * 60 * 60, sub }; // 12 hours exp

    const encodedHeader = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsigned = `${encodedHeader}.${encodedPayload}`;

    // Decode public key (65 bytes)
    const pub = base64urlDecode(publicKeyBase64);
    if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("Invalid VAPID public key format");

    const x = pub.slice(1, 33);
    const y = pub.slice(33, 65);

    // Import key
    const validKey = await crypto.subtle.importKey(
        "jwk",
        {
            kty: "EC", crv: "P-256",
            x: base64urlEncode(x),
            y: base64urlEncode(y),
            d: privateKeyBase64,
            ext: true
        },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        validKey,
        new TextEncoder().encode(unsigned)
    );

    return `${unsigned}.${base64urlEncode(new Uint8Array(signature))}`;
}

async function encryptPayload(payloadStr, p256dh, auth) {
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const kBytes = base64urlDecode(p256dh);
    const subscriberKey = await crypto.subtle.importKey('raw', kBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);

    const authBytes = base64urlDecode(auth);
    const prkKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', prkKey, sharedSecret);

    const infoBuffer = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
    const cekKeyImport = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    // CEK
    const cekInfo = new Uint8Array(salt.length + infoBuffer.length + 1);
    cekInfo.set(salt);
    cekInfo.set(infoBuffer, salt.length);
    cekInfo.set([1], salt.length + infoBuffer.length);
    const cek = (await crypto.subtle.sign('HMAC', cekKeyImport, cekInfo)).slice(0, 16);

    // Nonce
    const nonceInfoBuffer = new TextEncoder().encode("Content-Encoding: nonce\0");
    const nonceInfo = new Uint8Array(salt.length + nonceInfoBuffer.length + 1);
    nonceInfo.set(salt);
    nonceInfo.set(nonceInfoBuffer, salt.length);
    nonceInfo.set([1], salt.length + nonceInfoBuffer.length);
    const nonce = (await crypto.subtle.sign('HMAC', cekKeyImport, nonceInfo)).slice(0, 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const padding = new Uint8Array([2]); // Padding delimiter 0x02
    const payloadBytes = new TextEncoder().encode(payloadStr);
    const plaintext = new Uint8Array(payloadBytes.length + padding.length);
    plaintext.set(payloadBytes);
    plaintext.set(padding, payloadBytes.length);

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);
    return { ciphertext: new Uint8Array(ciphertext), salt, localPub };
}

async function sendPush(sub, payloadStr) {
    try {
        const aud = new URL(sub.endpoint).origin;
        const jwt = await createVapidJwt(aud, 'mailto:admin@test.com', VAPID_PUB, VAPID_PRIV);

        const { ciphertext, salt, localPub } = await encryptPayload(payloadStr, sub.p256dh, sub.auth);

        // Build binary body manually (safe for Deno/Node)
        const body = new Uint8Array(salt.length + 4 + 1 + localPub.length + ciphertext.length);
        let offset = 0;
        body.set(salt, offset); offset += salt.length;
        body.set([0, 0, 16, 0], offset); offset += 4;
        body.set([localPub.length], offset); offset += 1;
        body.set(localPub, offset); offset += localPub.length;
        body.set(ciphertext, offset);

        const resp = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `vapid t=${jwt}, k=${VAPID_PUB}`,
                'Content-Encoding': 'aes128gcm',
                'Content-Type': 'application/octet-stream', // Required for iOS
                'TTL': '2419200', // 28 days
                'Urgency': 'high'
            },
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
    console.log(`[${new Date().toISOString()}] Sending iOS Compatible Push...`);
    try {
        // Fetch most recent subscription
        const subs = await fetchJson(`${SUPABASE_URL}/rest/v1/push_subscriptions?order=created_at.desc&limit=1&select=*`);
        const targetSub = subs[0];

        if (!targetSub) {
            console.log("No subscription found.");
            return;
        }

        console.log(`Targeting ${targetSub.id}...`);

        // iOS-Complaint Payload
        const payload = JSON.stringify({
            notification: {
                title: "Test",
                body: "iOS Compatible Payload",
                icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
                badge: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
                data: {
                    url: "https://kotsiosla.github.io/MotionAG/"
                }
            }
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
