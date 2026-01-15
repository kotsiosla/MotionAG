const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=20',
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
                console.log(`Checking last ${logs.length} logs:`);
                logs.forEach((s) => {
                    const meta = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata;
                    console.log(`[${s.sent_at}] ${s.stop_id} | ${s.route_id} | ${s.step || meta.step} (${meta.version})`);
                    console.log(`   Metadata: ${JSON.stringify(meta, null, 2)}`);
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
