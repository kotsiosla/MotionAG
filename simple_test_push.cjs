const fs = require('fs');
const https = require('https');

async function sendFallbackTest() {
    const key = fs.readFileSync('key.txt', 'utf8').trim();

    // TARGET SUBSCRIPTIONS (From previous logs)
    const ANDROID_SUB_ID = 'adefe34f-b2c0-4f9f-aa5b-6c348067ef15';
    const IOS_SUB_ID = '96248926-2170-40d6-bcb7-977a89d7a59c';

    async function getSub(id) {
        const opt = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: `/rest/v1/stop_notification_subscriptions?select=*&id=eq.${id}&limit=1`,
            headers: { 'Authorization': 'Bearer ' + key, 'apikey': key }
        };
        return new Promise(resolve => {
            https.request(opt, r => {
                let d = ''; r.on('data', c => d += c);
                r.on('end', () => resolve(JSON.parse(d)[0]));
            }).end();
        });
    }

    function sendPush(sub, payloadData) {
        if (!sub) return console.error('Sub not found');

        // VAPID HEADERS (Simplified for debugging)
        // We really should generate a real JWT but we'll trust the existing function to fail if signature is wrong
        // Since we are using the 'test-push' EDGE FUNCTION, we just send a POST body.

        // STRATEGY: Send a payload that might trigger the fallback in push-worker.js
        // If we send raw string "TEST", JSON.parse("TEST") fails -> catch block -> shows fallback notification
        // If we send valid JSON, the worker tries to use it.

        const req = https.request({
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/functions/v1/test-push',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'apikey': key }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => console.log(`[Status: ${res.statusCode}] Response: ${d.substring(0, 100)}`));
        });

        // Send a VERY SIMPLE payload to minimize parsing errors
        req.write(JSON.stringify(payloadData));
        req.end();
    }

    console.log('Sending SIMPLE JSON payload...');
    const androidSub = await getSub(ANDROID_SUB_ID);
    if (androidSub) {
        // Just title and body, no complex data or icons
        sendPush(androidSub, { title: "SIMPLE TEST", body: "Can you see me now?" });
    }
}

sendFallbackTest();
