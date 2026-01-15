const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*&endpoint=ilike.*apple*',
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
                    const s = subs[0];
                    console.log(`\n🍎 iPhone Subscription Found:`);
                    console.log(`Endpoint: ${s.endpoint}`);
                    console.log(`Auth: ${s.auth}`);
                    console.log(`P256dh: ${s.p256dh}`);
                    console.log(`Settings: ${JSON.stringify(s.stop_notifications, null, 2)}`);
                    console.log(`Updated: ${s.updated_at}`);
                } else {
                    console.log("No iPhone sub found with ilike *apple*");
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
