
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

    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// --- CORE CRYPTO (MATCHING LOCAL_WORKER_USER.CJS EXACTLY) ---

export async function createVapidJwt(aud: string, sub: string, pub: string, priv: string): Promise<string> {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: aud, exp: now + 43200, sub: sub };
    const encoder = new TextEncoder();

    const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const unsigned = `${headerB64}.${payloadB64}`;

    const pubBytes = base64UrlDecode(pub);
    // Deno uses globalThis.crypto
    const key = await crypto.subtle.importKey(
        'jwk',
        {
            kty: "EC", crv: "P-256",
            x: base64UrlEncode(pubBytes.slice(1, 33)),
            y: base64UrlEncode(pubBytes.slice(33, 65)),
            d: priv,
            key_ops: ['sign'], ext: true
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
    return `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function encryptPayload(payloadStr: string, p256dh: string, auth: string) {
    const p256dhBytes = base64UrlDecode(p256dh);
    const authBytes = base64UrlDecode(auth);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Generate Local Key
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

    // Shared Secret
    const subscriberKey = await crypto.subtle.importKey('raw', p256dhBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey as CryptoKey, 256);

    // HKDF Helper
    async function hmac(key: Uint8Array, data: Uint8Array) {
        const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
    }

    async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
        const cekInput = new Uint8Array(info.length + 1);
        cekInput.set(info);
        cekInput.set([1], info.length);
        const block = await hmac(prk, cekInput);
        return block.slice(0, length);
    }

    // --- RFC 8291 Section 4 Extraction (MANDATORY FOR iOS) ---
    const encoder = new TextEncoder();
    const prkIkm = await hmac(authBytes, new Uint8Array(sharedSecret));
    const infoWebPush = new Uint8Array([...encoder.encode('WebPush: info'), 0, ...p256dhBytes, ...localPub]);
    const ikmWebPush = await hkdfExpand(prkIkm, infoWebPush, 32);

    // RFC 8188 Stage
    const prk = await hmac(salt, ikmWebPush);
    const cek = await hkdfExpand(prk, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdfExpand(prk, encoder.encode("Content-Encoding: nonce\0"), 12);

    // Encrypt
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const payloadBytes = encoder.encode(payloadStr);
    const plaintext = new Uint8Array(payloadBytes.length + 1);
    plaintext.set(payloadBytes);
    plaintext.set([2], payloadBytes.length); // Padding delimiter (2 = LAST)

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);

    return { ciphertext: new Uint8Array(ciphertext), salt, localPublicKey: localPub };
}
