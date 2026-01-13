
// Base64url encode/decode (Crucial for VAPID)
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function base64UrlEncode(data: Uint8Array): string {
    let result = "";
    let i = 0;
    const len = data.length;

    for (; i < len; i += 3) {
        const b1 = data[i];
        const b2 = i + 1 < len ? data[i + 1] : 0;
        const b3 = i + 2 < len ? data[i + 2] : 0;

        const trip = (b1 << 16) | (b2 << 8) | b3;

        result += B64_CHARS[(trip >> 18) & 0x3F] +
            B64_CHARS[(trip >> 12) & 0x3F] +
            (i + 1 < len ? B64_CHARS[(trip >> 6) & 0x3F] : "") +
            (i + 2 < len ? B64_CHARS[trip & 0x3F] : "");
    }
    return result;
}

export function base64UrlDecode(str: string): Uint8Array {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4 !== 0) str += '=';

    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let len = str.length;
    if (str.endsWith('==')) len -= 2;
    else if (str.endsWith('=')) len -= 1;

    const outLen = Math.floor(len * 3 / 4);
    const arr = new Uint8Array(outLen);

    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const c1 = b64.indexOf(str[i]);
        const c2 = b64.indexOf(str[i + 1]);
        const c3 = b64.indexOf(str[i + 2]);
        const c4 = b64.indexOf(str[i + 3]);
        const trip = (c1 << 18) | (c2 << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F);
        arr[p++] = (trip >> 16) & 0xFF;
        if (p < outLen) arr[p++] = (trip >> 8) & 0xFF;
        if (p < outLen) arr[p++] = trip & 0xFF;
    }
    return arr;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const prkKey = await crypto.subtle.importKey('raw', new Uint8Array(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, new Uint8Array(data)));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const block = await hmac(new Uint8Array(prk), new Uint8Array([...info, 1]));
    return block.slice(0, length);
}

export async function createVapidJwt(audience: string, subject: string, publicKeyBase64: string, privateKeyBase64: string): Promise<string> {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: audience, exp: now + 86400, sub: subject };
    const encoder = new TextEncoder();

    const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const privBytes = base64UrlDecode(privateKeyBase64);
    const pubBytes = base64UrlDecode(publicKeyBase64);

    const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        {
            kty: "EC", crv: "P-256", ext: true,
            x: base64UrlEncode(pubBytes.slice(1, 33)),
            y: base64UrlEncode(pubBytes.slice(33, 65)),
            d: privateKeyBase64
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, encoder.encode(unsignedToken));
    return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function encryptPayload(payload: string, p256dhKey: string, authSecret: string) {
    const encoder = new TextEncoder();
    const p256dh = base64UrlDecode(p256dhKey);
    const auth = base64UrlDecode(authSecret);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

    const subscriberKey = await crypto.subtle.importKey('raw', new Uint8Array(p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256));

    // STAGE 1: RFC 8291 Section 4 extraction
    const prkIkm = await hmac(auth, sharedSecret);
    const infoWebPush = new Uint8Array([
        ...encoder.encode('WebPush: info'), 0,
        ...p256dh,
        ...localPublicKey
    ]);
    const ikmWebPush = await hkdfExpand(prkIkm, infoWebPush, 32);

    // STAGE 2: RFC 8188 Stage
    const prk = await hmac(new Uint8Array(salt), ikmWebPush);
    const cek = await hkdfExpand(prk, new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'), 0]), 16);
    const nonce = await hkdfExpand(prk, new Uint8Array([...encoder.encode('Content-Encoding: nonce'), 0]), 12);

    const aesKey = await crypto.subtle.importKey('raw', new Uint8Array(cek), { name: 'AES-GCM' }, false, ['encrypt']);
    const padded = new Uint8Array([...encoder.encode(payload), 2]); // LAST RECORD
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

    return { ciphertext, salt, localPublicKey };
}
