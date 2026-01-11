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

                console.log(`SUBSCRIPTIONS FOUND: ${subs.length}`);

                const targetStop = '2811';
                const MATCHES = subs.filter(s =>
                    s.stop_notifications &&
                    s.stop_notifications.some(n => n.stopId === targetStop || n.stop_code === targetStop)
                );

                console.log(`\nFound ${MATCHES.length} subscriptions for Stop ${targetStop}:`);
                MATCHES.forEach((m, i) => {
                    console.log(`\nMatch #${i + 1}:`);
                    // Find the specific notification for this stop
                    const notif = m.stop_notifications.find(n => n.stopId === targetStop || n.stop_code === targetStop);
                    console.log(`  Stop Name: ${notif.stopName}`);
                    console.log(`  Before Minutes: ${notif.beforeMinutes}`);
                    console.log(`  Push Enabled: ${notif.push}`);
                    console.log(`  Created At: ${m.created_at}`);
                    const endpointDomain = new URL(m.endpoint).hostname;
                    console.log(`  Endpoint Domain: ${endpointDomain}`);
                    console.log(`  Device ID: ${m.id ? m.id.substring(0, 10) : 'N/A'}...`);
                });
            } catch (e) {
                console.log("Error parsing: " + data);
            }
        });
    });
    req.end();
} catch (e) { console.error(e); }
