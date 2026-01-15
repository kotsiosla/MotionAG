const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/push_subscriptions?select=*&endpoint=like.*fcm.googleapis.com*',
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
                console.log(`\n🤖 Found ${subs.length} Android General Subscriptions:`);
                subs.forEach((sub, i) => {
                    console.log(`\n#${i}:`);
                    console.log('   Endpoint:', sub.endpoint.substring(0, 50) + '...');
                    console.log('   Updated:', sub.updated_at);
                    console.log('   Route IDs:', JSON.stringify(sub.route_ids));
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
