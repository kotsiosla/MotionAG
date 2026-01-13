
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
    // Generate Local Key
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Shared Secret
    const subscriberKey = await crypto.subtle.importKey('raw', base64UrlDecode(p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey as CryptoKey, 256);

    // HKDF / PRK
    const authBytes = base64UrlDecode(auth);
    const prkKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await crypto.subtle.sign('HMAC', prkKey, sharedSecret);

    // CEK
    const encoder = new TextEncoder();
    const infoBuffer = encoder.encode("Content-Encoding: aes128gcm\0");
    const cekKeyImport = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    // Concat: [salt, infoBuffer, 0x01]
    const cekInput = new Uint8Array(salt.length + infoBuffer.length + 1);
    cekInput.set(salt);
    cekInput.set(infoBuffer, salt.length);
    cekInput.set([1], salt.length + infoBuffer.length);

    const cekSig = await crypto.subtle.sign('HMAC', cekKeyImport, cekInput);
    const cek = new Uint8Array(cekSig).slice(0, 16);

    // Nonce
    const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
    const nonceInput = new Uint8Array(salt.length + nonceInfo.length + 1);
    nonceInput.set(salt);
    nonceInput.set(nonceInfo, salt.length);
    nonceInput.set([1], salt.length + nonceInfo.length);

    const nonceSig = await crypto.subtle.sign('HMAC', cekKeyImport, nonceInput);
    const nonce = new Uint8Array(nonceSig).slice(0, 12);

    // Encrypt
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const payloadBytes = encoder.encode(payloadStr);
    const plaintext = new Uint8Array(payloadBytes.length + 1);
    plaintext.set(payloadBytes);
    plaintext.set([2], payloadBytes.length); // Padding delimiter

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext);

    return { ciphertext: new Uint8Array(ciphertext), salt, localPublicKey: localPub };
}
