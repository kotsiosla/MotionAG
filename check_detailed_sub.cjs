const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=updated_at.desc&limit=1',
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
                    console.log('Latest Sub Details:');
                    console.log('Endpoint:', subs[0].endpoint.substring(0, 50) + '...');
                    console.log('Stop Notifications:', JSON.stringify(subs[0].stop_notifications, null, 2));
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
