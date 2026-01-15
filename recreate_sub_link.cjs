const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('key.txt', 'utf8').trim();

function request(path, method, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: path,
            method: method,
            headers: {
                'Authorization': 'Bearer ' + key,
                'apikey': key,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) { resolve(data); }
                } else {
                    reject({ status: res.statusCode, body: data });
                }
            });
        });

        if (body) req.write(body);
        req.end();
    });
}

async function run() {
    try {
        console.log('Fetching latest subscription...');
        const subs = await request('/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=1', 'GET');

        if (!subs || subs.length === 0) {
            console.error('No subscriptions found!');
            return;
        }

        const s = subs[0];
        console.log('Found subscription:', s.id);

        let p256dh = s.p256dh;
        if (!p256dh && s.keys && s.keys.p256dh) p256dh = s.keys.p256dh;

        let auth = s.auth;
        if (!auth && s.keys && s.keys.auth) auth = s.keys.auth;

        if (!p256dh || !auth) {
            console.error('Missing keys in subscription:', s);
            // Try to extract from keys object if flattened keys are missing
            if (s.keys) {
                if (s.keys.p256dh) p256dh = s.keys.p256dh;
                if (s.keys.auth) auth = s.keys.auth;
            }
        }

        // Final fallback validation
        if (!p256dh || !auth) {
            console.error('failed to extract keys', s);
            return;
        }

        const payload = {
            endpoint: s.endpoint,
            p256dh: p256dh,
            auth: auth,
            stop_notifications: [{
                stopId: '2811',
                stopName: 'Debug Link',
                enabled: true,
                push: true,
                beforeMinutes: 5
            }],
            updated_at: new Date().toISOString()
        };

        console.log('Upserting to stop_notification_subscriptions...');

        try {
            const result = await request('/rest/v1/stop_notification_subscriptions?on_conflict=endpoint', 'POST', JSON.stringify(payload));
            console.log('SUCCESS: Link created for route 2811 using sub ' + s.id);
            console.log(JSON.stringify(result));
        } catch (err) {
            console.log('Upsert Failed:', err);
            // Verify if it failed because of keys?
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

run();
