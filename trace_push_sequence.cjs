const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    // Fetch logs around 13:41:36
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
                console.log('--- LOGS AROUND PUSH TIME ---');
                logs.forEach(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`[${l.sent_at}] Step: ${l.step || meta?.step} | Stop: ${l.stop_id} | Route: ${l.route_id}`);
                    if (meta?.error || meta?.push_results) {
                        console.log('   DETAIL:', JSON.stringify(meta, null, 2));
                    }
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
