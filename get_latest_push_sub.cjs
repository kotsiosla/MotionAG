const https = require('https');
const fs = require('fs');
const key = fs.readFileSync('key.txt', 'utf8').trim();

function httpsRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, data });
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    try {
        const options = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=5',
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + key,
                apikey: key,
            },
        };
        const { data } = await httpsRequest(options);
        console.log('LATEST PUSH_SUBSCRIPTIONS:');
        console.log(data);
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
