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
                console.log(`\n=== Latest 20 Notification Logs ===`);
                logs.forEach((l) => {
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    const time = l.sent_at || l.created_at;
                    const step = l.step || meta?.step || 'PUSH';
                    const ver = meta?.version || 'N/A';

                    console.log(`[${time}] ${l.stop_id} | ${l.route_id} | ${step} (${ver})`);
                    if (meta?.error) {
                        console.log(`   ❌ ERROR: ${JSON.stringify(meta.error)}`);
                    } else if (step === 'SYNC_SUCCESS' || step === 'SUB_CREATED') {
                        console.log(`   ✅ SUCCESS`);
                    }
                });
            } catch (e) {
                console.log('Parse error:', e.message);
                console.log('Raw:', data.substring(0, 200));
            }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
