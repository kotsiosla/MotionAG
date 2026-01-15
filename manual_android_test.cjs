const fs = require('fs');
const https = require('https');

async function sendManualTest() {
    const key = fs.readFileSync('key.txt', 'utf8').trim();

    // 1. Get the latest Android subscription
    const getOpt = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=updated_at.desc&limit=1',
        headers: {
            'Authorization': 'Bearer ' + key,
            'apikey': key
        }
    };

    const sub = await new Promise((resolve) => {
        https.request(getOpt, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => resolve(JSON.parse(d)[0]));
        }).end();
    });

    if (!sub) {
        console.error('No subscription found!');
        return;
    }

    console.log('Sending test to:', sub.endpoint.substring(0, 50) + '...');

    // 2. Trigger the test-push edge function
    const payload = JSON.stringify({
        subscription: {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        },
        payload: {
            title: 'Android Test ✅',
            body: 'Αυτό είναι ένα δοκιμαστικό μήνυμα για το ' + sub.id.substring(0, 4),
            data: { url: '/MotionAG/' }
        }
    });

    const postOpt = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/test-push',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'apikey': key
        }
    };

    const req = https.request(postOpt, res => {
        let resData = '';
        res.on('data', d => resData += d);
        res.on('end', () => {
            console.log('Server Response:', res.statusCode, resData);
        });
    });

    req.on('error', e => console.error(e));
    req.write(payload);
    req.end();
}

sendManualTest();
