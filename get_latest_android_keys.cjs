const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&endpoint=like.*fcm.googleapis.com*&order=updated_at.desc&limit=1',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'apikey': key
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const subs = JSON.parse(data);
                if (subs.length > 0) {
                    const sub = subs[0];
                    console.log('🤖 Latest Android Sub Keys:');
                    console.log('Endpoint:', sub.endpoint);
                    console.log('P256dh:', sub.p256dh);
                    console.log('Auth:', sub.auth);
                    console.log('Updated:', sub.updated_at);
                } else {
                    console.log('No Android subscriptions found.');
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
