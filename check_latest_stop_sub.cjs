const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=updated_at.desc&limit=3',
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
                console.log('Count:', subs.length);
                subs.forEach((s, i) => {
                    console.log(`\n#${i} Endpoint:`, s.endpoint.substring(0, 50) + '...');
                    console.log('   Updated:', s.updated_at);
                    if (i === 0) {
                        console.log('   KEYS:', JSON.stringify({
                            endpoint: s.endpoint,
                            auth: s.auth,
                            p256dh: s.p256dh
                        }));
                    }
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
