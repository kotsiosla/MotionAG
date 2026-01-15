const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const subId = '475266e7-4ddd-4caf-9888-c8216dd82751';

    const opt = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: `/rest/v1/stop_notification_subscriptions?id=eq.${subId}&select=*`,
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'apikey': key
        }
    };

    https.request(opt, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
            fs.writeFileSync('raw_sub_debug.json', d);
            console.log('Saved to raw_sub_debug.json');
        });
    }).end();
} catch (e) {
    console.error(e);
}
