const fs = require('fs');
const https = require('https');

async function sendDualTest() {
    const key = fs.readFileSync('key.txt', 'utf8').trim();

    // TARGET SUBSCRIPTIONS FROM LOGS
    const ANDROID_SUB_ID = '8625a951-b21f-4389-a9cf-f88835b84829';
    const IOS_SUB_ID = '96248926-2170-40d6-bcb7-977a89d7a59c';

    // Helper to get sub details
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

    // Helper to send push
    function sendPush(sub, title, body) {
        if (!sub) return console.error('Sub not found');
        const payload = JSON.stringify({
            subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload: { title, body, data: { url: '/MotionAG/' } }
        });

        const req = https.request({
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/functions/v1/test-push',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'apikey': key }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => console.log(`[${title}] Status: ${res.statusCode} | Response: ${d.substring(0, 100)}...`));
        });
        req.write(payload);
        req.end();
    }

    // EXECUTE
    console.log('Fetching details...');
    const androidSub = await getSub(ANDROID_SUB_ID);
    const iosSub = await getSub(IOS_SUB_ID);

    if (androidSub) {
        console.log('Sending to Android (App Closed Test)...');
        sendPush(androidSub, '🤖 Android Final Check', 'App Closed Test: SUCCESS ✅');
    }

    if (iosSub) {
        console.log('Sending to iOS (Safari Check)...');
        sendPush(iosSub, '🍎 iPhone Final Check', 'Safari SW Fix: SUCCESS ✅');
    }
}

sendDualTest();
