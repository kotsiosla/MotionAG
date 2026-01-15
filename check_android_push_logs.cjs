const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    // Query notifications_log where metadata contains fcm.googleapis.com
    // Note: We search for PUSH_SENT in the step field if it's there, or just general logs
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=50',
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
                if (!Array.isArray(logs)) {
                    console.log('Response is not an array:', logs);
                    return;
                }
                console.log(`\n🤖 Recent Push Logs Analysis:`);
                const androidLogs = logs.filter(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    const metaStr = JSON.stringify(meta);
                    return metaStr && metaStr.includes('fcm.googleapis.com');
                });

                if (androidLogs.length === 0) {
                    console.log('No recent logs found mentioning FCM endpoints.');
                    return;
                }

                console.log(`Found ${androidLogs.length} logs for Android:`);
                androidLogs.forEach((l, i) => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`\n#${i} [${l.sent_at}]`);
                    console.log(`   Step: ${l.step || meta.step}`);
                    console.log(`   Stop: ${l.stop_id}`);
                    console.log(`   Route: ${l.route_id}`);
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
