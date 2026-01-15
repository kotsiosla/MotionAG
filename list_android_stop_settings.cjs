const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&endpoint=like.*fcm.googleapis.com*',
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
                console.log(`\n🤖 Found ${subs.length} Android Stop-Specific Subscriptions:`);
                subs.forEach((sub, i) => {
                    console.log(`\n#${i}:`);
                    console.log('   Endpoint:', sub.endpoint.substring(0, 50) + '...');
                    console.log('   Updated:', sub.updated_at);
                    console.log('   Settings:', JSON.stringify(sub.stop_notifications, null, 2));
                });
            } catch (e) {
                console.log('Error parsing response:', e.message);
            }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
