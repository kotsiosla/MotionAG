const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    // Fetch all PUSH_SENT logs
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        // Filter by step=PUSH_SENT (implicit in logs where metadata has certain fields)
        // Actually, let's just get the last 200 logs to be sure
        path: '/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=200',
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
                console.log(`\n🤖 Android Push History (Last 200 logs):`);
                const pushedAndroid = logs.filter(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    const metaStr = JSON.stringify(meta);
                    return metaStr.includes('fcm.googleapis.com') && (l.step === 'PUSH_SENT' || !l.step);
                });

                if (pushedAndroid.length === 0) {
                    console.log('No PUSH_SENT logs found for Android.');
                    return;
                }

                console.log(`Found ${pushedAndroid.length} push deliveries for Android:`);
                pushedAndroid.forEach((l, i) => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`\n#${i} [${l.sent_at}]`);
                    console.log(`   Stop: ${l.stop_id}`);
                    console.log(`   Route: ${l.route_id}`);
                    console.log(`   Status: ${meta.push_success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
                    if (meta.error) console.log(`   Error: ${JSON.stringify(meta.error)}`);
                });
            } catch (e) {
                console.log('Error parsing response:', e.message);
            }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
