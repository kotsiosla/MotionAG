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
                console.log('Count:', subs.length);
                subs.forEach((s, i) => {
                    console.log(`#${i} ID:`, s.id);
                    console.log('    Time:', s.created_at);
                    console.log('    Endpoint:', s.endpoint.substring(0, 40) + '...');
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
