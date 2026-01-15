const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&route_id=eq.DIAGNOSTIC_V2&order=sent_at.desc&limit=20',
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
                console.log('--- RECENT CLIENT DIAGNOSTICS ---');
                logs.forEach(l => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log(`[${l.sent_at}] Step: ${meta?.step} | Version: ${meta?.version}`);
                    if (meta?.error || meta?.reason) {
                        console.log('   ALERT:', meta.error || meta.reason);
                        console.log('   FULL:', JSON.stringify(meta, null, 2));
                    }
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
