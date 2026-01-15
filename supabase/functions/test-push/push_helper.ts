
import { createVapidJwt, encryptPayload } from './vapid_helper.ts';

export async function sendPushNotification(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string,
    fromEmail: string = 'mailto:info@motionbus.cy'
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    try {
        const endpointUrl = new URL(endpoint);
        const aud = `${endpointUrl.protocol}//${endpointUrl.hostname}`;

        // console.log(`[Push] Sending to ${endpoint.slice(0, 30)}...`);
        // console.log(`[Push] Payload length: ${payload.length}`);

        let jwt;
        try {
            // Note: createVapidJwt in vapid_helper.ts takes (aud, sub, pub, priv)
            jwt = await createVapidJwt(aud, fromEmail, vapidPublicKey, vapidPrivateKey);
            // console.log('[Push] JWT created');
        } catch (e) { throw new Error(`CreateVapidJWT Failed: ${e}`); }

        let ciphertext, salt, localPublicKey;
        try {
            ({ ciphertext, salt, localPublicKey } = await encryptPayload(payload, p256dh, auth));
            // console.log('[Push] Payload encrypted');
        } catch (e) { throw new Error(`EncryptPayload Failed: ${e}`); }

        // Assemble AES128GCM body (Salt + RecordSize + KeyIdLen + KeyId + Ciphertext)
        // Record Size = 4096 (0, 0, 16, 0)
        // Key ID Length = 65 (0x41)
        const body = new Uint8Array([...salt, 0, 0, 16, 0, 65, ...localPublicKey, ...ciphertext]);

        const pushResp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/octet-stream',
                'content-encoding': 'aes128gcm',
                'authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
                'ttl': '86400',
                'urgency': 'high'
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
