const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&endpoint=like.*fcm.googleapis.com*&order=updated_at.desc&limit=5',
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
                console.log(`\n🤖 Found ${subs.length} Android Subscriptions:`);
                subs.forEach((sub, i) => {
                    console.log(`\n#${i}:`);
                    console.log('   Endpoint:', sub.endpoint.substring(0, 50) + '...');
                    console.log('   Updated:', sub.updated_at);
                    console.log('   Stop Notifications Count:', sub.stop_notifications ? sub.stop_notifications.length : 0);
                    if (sub.stop_notifications && sub.stop_notifications.length > 0) {
                        console.log('   Details:', JSON.stringify(sub.stop_notifications, null, 2));
                    }
                });
            } catch (e) {
                console.log('Error parsing response:', e.message);
            }
        });
    });
    req.on('error', (e) => console.error('Request error:', e));
    req.end();
} catch (e) {
    console.error('Script error:', e);
}
