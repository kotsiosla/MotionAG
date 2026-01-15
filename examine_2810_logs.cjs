const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&stop_id=eq.2810&order=sent_at.desc&limit=10',
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
                console.log('--- NOTIFICATION LOGS FOR STOP 2810 ---');
                logs.forEach(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`[${l.sent_at}] Route: ${l.route_id} | Alert Level: ${l.alert_level}`);
                    console.log('   Metadata:', JSON.stringify(meta, null, 2));
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
