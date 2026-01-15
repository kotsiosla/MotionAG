const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const endpointSearch = 'dK08x8tY24M:APA91';
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
                    console.log('\n🤖 Targeted Android Sub Details:');
                    console.log('Endpoint:', sub.endpoint.substring(0, 50) + '...');
                    console.log('Updated:', sub.updated_at);
                    console.log('Stop Notifications:', JSON.stringify(sub.stop_notifications, null, 2));
                } else {
                    console.log('No subscription found matching:', endpointSearch);
                }
            } catch (e) {
                console.log('Error parsing response:', e.message);
            }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
