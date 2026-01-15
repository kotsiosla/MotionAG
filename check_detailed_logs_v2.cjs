const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=5',
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
                console.log('--- Top 5 Detailed Logs ---');
                logs.forEach(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`[${l.sent_at}] ${l.stop_id} | ${l.route_id} | ${l.step || meta?.step}`);
                    console.log('Metadata:', JSON.stringify(meta, null, 2));
                    console.log('---------------------------');
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
