const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const endpointSearch = 'diHE6U81yo8';
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: `/rest/v1/stop_notification_subscriptions?select=*&endpoint=like.*${endpointSearch}*`,
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
                    console.log('🤖 Active Android Sub Keys (Stop 2793):');
                    console.log('Endpoint:', sub.endpoint);
                    console.log('P256dh:', sub.p256dh);
                    console.log('Auth:', sub.auth);
                } else {
                    console.log('No subscription found matching:', endpointSearch);
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
