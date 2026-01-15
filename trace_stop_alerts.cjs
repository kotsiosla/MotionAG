const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
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
                console.log('--- RECENT NOTIFICATION LOGS ---');
                logs.forEach(l => {
                    if (l.stop_id === '2810' || l.stop_id === '7839' || l.stop_id === '2793') {
                        const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                        console.log(`[${l.sent_at}] Stop: ${l.stop_id} | Route: ${l.route_id} | Status: ${meta?.status_code || 'N/A'} | Success: ${meta?.push_success}`);
                        if (meta?.error) console.log(`   ERROR: ${meta.error}`);
                    }
                });
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
