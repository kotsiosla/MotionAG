const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=5',
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
                const results = [];
                subs.forEach(s => {
                    if (s.endpoint && s.endpoint.includes('apple')) {
                        results.push({
                            endpoint: s.endpoint,
                            auth: s.auth || (s.keys && s.keys.auth),
                            p256dh: s.p256dh || (s.keys && s.keys.p256dh)
                        });
                    }
                });
                console.log('ALL_APPLE_SUBS:' + JSON.stringify(results));
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
