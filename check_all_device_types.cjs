const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=updated_at.desc',
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
                console.log(`Checking all ${subs.length} subscriptions...`);
                subs.forEach((s, i) => {
                    const type = s.endpoint.includes('apple.com') ? '🍎 iPhone' :
                        s.endpoint.includes('google.com') ? '🤖 Android' : '❓ Unknown';
                    console.log(`\n#${i} [${type}]`);
                    console.log(`   Endpoint: ${s.endpoint.substring(0, 50)}...`);
                    console.log(`   Updated: ${s.updated_at}`);
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
