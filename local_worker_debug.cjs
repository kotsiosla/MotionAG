const crypto = require('crypto').webcrypto || globalThis.crypto;

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const VAPID_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const VAPID_PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

const encoder = new TextEncoder();

function b64u(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64d(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
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

    const ikmK = await crypto.subtle.importKey('raw', auth, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', ikmK, ss));
    const prkK = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    const cek = (new Uint8Array(await crypto.subtle.sign('HMAC', prkK, new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm\0'), 1])))).slice(0, 16);
    const non = (new Uint8Array(await crypto.subtle.sign('HMAC', prkK, new Uint8Array([...encoder.encode('Content-Encoding: nonce\0'), 1])))).slice(0, 12);

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
        id: "57d99f86-3d0e-4400-bb85-4dc0bd00b295",
        endpoint: "https://web.push.apple.com/QEV-l1zVegYps3vvnYaB8kzF7jgdbnqGFLtZRvoBd5pWzViCOZjsTKhwBglMzRrKh1YySKPiHGwZzW1g0-SEWbSi24n-T1SSrXZJNNa-hCtC71Y8rNHDH6JX1jgRqdOPyvZbAsMRsY6NZoiK8hMSKAdJ6OJKBakW8EPLDvGWedA",
        p256dh: "BEnKJBXHWIKeh7YgM06ugTUS3Zzor1C+53Rn1Dwirw8xBWKcUr1fY7wlxIrFMf4f4z+ygcZUNSB9wsxvCqR0SBo=",
        auth: "AFeibwkBZQPiA9En4ZY/mQ=="
    };

    const payload = JSON.stringify({
        notification: {
            title: "Motion Bus Live",
            body: "This is a visible notification test! 🚌",
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
            'TTL': '3600'
        },
        body
    });

    console.log(`Status: ${res.status}`);
}

run().catch(e => console.log(e));
