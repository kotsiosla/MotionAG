const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const stopId = '2810';
    // Using Postgres @> operator for JSONB filtering is tricky via REST, 
    // we'll just fetch recent and filter in JS
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&order=updated_at.desc&limit=10',
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
                console.log(`--- Searching for Stop ${stopId} in last 10 subs ---`);
                let found = false;
                subs.forEach(s => {
                    const notifs = s.stop_notifications || [];
                    if (notifs.some(n => n.stopId === stopId)) {
                        console.log(`✅ FOUND in sub updated at ${s.updated_at}`);
                        console.log(`   Endpoint: ${s.endpoint.substring(0, 50)}...`);
                        found = true;
                    }
                });
                if (!found) console.log('❌ Not found in recent subscriptions.');
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
