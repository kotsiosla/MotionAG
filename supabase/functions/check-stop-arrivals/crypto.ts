
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Base64url encode/decode (Crucial for VAPID)
export function base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Uint8Array {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padding);
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// VAPID & Encryption (Manual Implementation for Deno/Edge compatibility)

export async function createVapidJwt(audience: string, subject: string, privateKeyBase64: string): Promise<string> {
    const header = { alg: 'ES256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: audience, exp: now + 86400, sub: subject };
    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // KEY FIX: Determine if Raw or PKCS#8
    let privateKeyBytes = base64UrlDecode(privateKeyBase64);
    let pkcs8Key = privateKeyBytes;

    if (privateKeyBytes.length === 32) {
        // It's a raw scalar (32 bytes), prepend P-256 Params Header
        const pkcs8Header = new Uint8Array([0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20]);
        pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyBytes]);
    } else {
        // Assume full PKCS#8
    }

    const cryptoKey = await crypto.subtle.importKey('pkcs8', pkcs8Key, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(unsignedToken));
    return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function encryptPayload(payload: string, p256dhKey: string, authSecret: string) {
    // Generate local key
    const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Import Subscriber Key
    const subscriberKey = await crypto.subtle.importKey('raw', base64UrlDecode(p256dhKey).buffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeyPair.privateKey, 256);

    // HKDF Helpers
    const authSecretBytes = base64UrlDecode(authSecret);
    const prkKey = await crypto.subtle.importKey('raw', authSecretBytes.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, new Uint8Array(sharedSecret)));

    const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
    const cekKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const cek = (new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...cekInfo, 1])))).slice(0, 16);

    const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
    const nonce = (new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...nonceInfo, 1])))).slice(0, 12);

    // Encrypt
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const padded = new Uint8Array([...new TextEncoder().encode(payload), 2]); // Padding: 2
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

    return { ciphertext, salt, localPublicKey };
}
