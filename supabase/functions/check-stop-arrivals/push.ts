
import { createVapidJwt, encryptPayload } from './crypto.ts';

export async function sendPushNotification(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string,
    fromEmail: string = 'mailto:admin@motionbus.cy'
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    try {
        const endpointUrl = new URL(endpoint);
        const aud = `${endpointUrl.protocol}//${endpointUrl.hostname}`;

        console.log(`[Push] Sending to ${endpoint.slice(0, 30)}...`);
        console.log(`[Push] Payload length: ${payload.length}`);

        let jwt;
        try {
            jwt = await createVapidJwt(aud, fromEmail, vapidPublicKey, vapidPrivateKey);
            console.log('[Push] JWT created');
        } catch (e) { throw new Error(`CreateVapidJWT Failed: ${e}`); }

        let ciphertext, salt, localPublicKey;
        try {
            ({ ciphertext, salt, localPublicKey } = await encryptPayload(payload, p256dh, auth));
            console.log('[Push] Payload encrypted');
        } catch (e) { throw new Error(`EncryptPayload Failed: ${e}`); }

        const body = new Uint8Array(16 + 4 + 1 + localPublicKey.length + ciphertext.length);
        let offset = 0;
        body.set(salt, offset); offset += 16;
        body.set([0, 0, 16, 0], offset); offset += 4; // Record Size (4096)
        body.set([localPublicKey.length], offset); offset += 1;
        body.set(localPublicKey, offset); offset += localPublicKey.length;
        body.set(ciphertext, offset);

        const pushResp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Encoding': 'aes128gcm',
                'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
                'TTL': '86400',
                'Urgency': 'high'
            },
            body
        });

        if (pushResp.ok) {
            return { success: true, statusCode: pushResp.status };
        } else {
            const txt = await pushResp.text();
            return { success: false, statusCode: pushResp.status, error: txt };
        }
    } catch (err) {
        return { success: false, error: `TopLevel: ${String(err)}` };
    }
}
