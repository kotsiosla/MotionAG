const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&endpoint=like.*apple.com*&order=updated_at.desc&limit=1',
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
                    const s = subs[0];
                    console.log('--- LATEST IPHONE SUB ---');
                    console.log('Updated At:', s.updated_at);
                    console.log('Endpoint:', s.endpoint.substring(0, 50) + '...');
                    console.log('Notifications:', JSON.stringify(s.stop_notifications, null, 2));
                } else {
                    console.log('No iPhone subs found.');
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
