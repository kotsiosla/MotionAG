const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/notifications_log?select=*&order=sent_at.desc&limit=1',
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
                if (logs.length > 0) {
                    const l = logs[0];
                    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
                    console.log('--- FAILED NOTIFICATION DETAILS ---');
                    console.log(`Sent At: ${l.sent_at}`);
                    console.log(`Stop: ${l.stop_id}`);
                    console.log(`Step: ${l.step}`);
                    console.log('Metadata:', JSON.stringify(meta, null, 2));

                    if (meta.push_results) {
                        console.log('\nApple Push Service Result:');
                        console.log(JSON.stringify(meta.push_results, null, 2));
                    }
                }
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
