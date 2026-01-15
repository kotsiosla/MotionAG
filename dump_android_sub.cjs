const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=10',
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
                const androidSubs = subs.filter(s => s.endpoint && s.endpoint.includes('google'));

                if (androidSubs.length > 0) {
                    console.log('Found ' + androidSubs.length + ' Android subscriptions.');
                    const s = androidSubs[0]; // Latest one
                    const obj = {
                        endpoint: s.endpoint,
                        auth: s.auth || (s.keys && s.keys.auth),
                        p256dh: s.p256dh || (s.keys && s.keys.p256dh)
                    };
                    console.log('ANDROID_KEYS:' + JSON.stringify(obj, null, 2));
                    console.log('ID:', s.id);
                    console.log('Created:', s.created_at);
                } else {
                    console.log('No Android subscriptions found.');
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
