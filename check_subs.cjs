const { createClient } = require('@supabase/supabase-js');
// Load keys from file or env? Use simple method if possible or hardcode for this check if user provides.
// Actually, I'll use the 'test_api.cjs' method with fs reading key.txt to query via REST if possible.
// Or just use 'fix_env.cjs' style if it has dotenv.
const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=*',
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
                console.log("SUBSCRIPTIONS FOUND: " + subs.length);
                subs.forEach(s => {
                    if (s.stop_notifications) {
                        const target = s.stop_notifications.find(n => n.stopId === '2877');
                        if (target) {
                            console.log("FOUND STOP 2877 SUB:");
                            console.log(JSON.stringify(target, null, 2));
                        }
                    }
                });
            } catch (e) {
                console.log("Error parsing: " + data);
            }
        });
    });
    req.end();
} catch (e) { console.error(e); }
