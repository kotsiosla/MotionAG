
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
        const jwt = await createVapidJwt(aud, fromEmail, vapidPrivateKey);
        const { ciphertext, salt, localPublicKey } = await encryptPayload(payload, p256dh, auth);

        const body = new Uint8Array([...salt, 0, 0, 16, 0, 65, ...localPublicKey, ...ciphertext]);

        const pushResp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Encoding': 'aes128gcm',
                'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
                // CRITICAL: High TTL
                'TTL': '86400'
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
        return { success: false, error: String(err) };
    }
}
