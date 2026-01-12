const https = require('https');

// Service role key (already known)
const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';

// Helper to perform HTTPS request returning a Promise
function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, data });
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function getLatestSubscription() {
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=created_at.desc&limit=1',
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + key,
            apikey: key,
        },
    };
    const { data } = await httpsRequest(options);
    const subs = JSON.parse(data);
    if (!Array.isArray(subs) || subs.length === 0) {
        throw new Error('No subscriptions found');
    }
    return subs[0];
}

async function sendTestPush(subscription) {
    const payload = JSON.stringify({
        title: '🚌 iOS Test Alert (latest)',
        body: 'This is a fresh test push using the most recent subscription.',
        icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
    });

    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/test-push',
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
        },
    };

    const body = JSON.stringify({
        subscription: {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
            },
        },
        message: payload,
    });

    const result = await httpsRequest(options, body);
    console.log('STATUS:', result.statusCode);
    try {
        console.log('Response:', JSON.parse(result.data));
    } catch (e) {
        console.log('Raw response:', result.data);
    }
}

(async () => {
    try {
        const sub = await getLatestSubscription();
        console.log('Using subscription ID:', sub.id);
        await sendTestPush(sub);
    } catch (err) {
        console.error('Error:', err);
    }
})();
