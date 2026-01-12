const https = require('https');
const fs = require('fs');
const key = fs.readFileSync('key.txt', 'utf8').trim();

function httpsRequest(options, postData) {
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
        if (postData) req.write(postData);
        req.end();
    });
}

(async () => {
    try {
        const dummy = {
            endpoint: 'https://web.push.apple.com/fake-endpoint-12345',
            p256dh: Buffer.from('dummy-p256dh').toString('base64'),
            auth: Buffer.from('dummy-auth').toString('base64'),
            route_ids: []
        };
        const options = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/rest/v1/push_subscriptions',
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                apikey: key,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
        };
        const { data } = await httpsRequest(options, JSON.stringify(dummy));
        console.log('Inserted dummy subscription:');
        console.log(data);
    } catch (e) {
        console.error('Error inserting dummy subscription:', e.message);
    }
})();
