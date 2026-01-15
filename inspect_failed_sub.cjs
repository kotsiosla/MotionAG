const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();

    // 1. Get the last notification sub ID
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=subscription_id&stop_id=eq.2810&order=sent_at.desc&limit=1',
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
                const logs = JSON.parse(data);
                if (logs.length > 0) {
                    const subId = logs[0].subscription_id;
                    console.log(`Targeting Subscription: ${subId}`);

                    // 2. Get the full subscription info
                    const subOpt = {
                        hostname: 'jftthfniwfarxyisszjh.supabase.co',
                        path: `/rest/v1/stop_notification_subscriptions?id=eq.${subId}&select=*`,
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + key,
                            'apikey': key
                        }
                    };

                    https.request(subOpt, (subRes) => {
                        let subData = '';
                        subRes.on('data', c => subData += c);
                        subRes.on('end', () => {
                            console.log('--- SUBSCRIPTION DATA ---');
                            console.log(subData);
                        });
                    }).end();
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
