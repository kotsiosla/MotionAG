const https = require('https');
const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';

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
            path: '/rest/v1/stop_notification_subscriptions',
            method: 'DELETE',
            headers: {
                Authorization: 'Bearer ' + key,
                apikey: key,
            },
        };
        const result = await httpsRequest(options);
        console.log('DELETE ALL status:', result.statusCode);
        console.log('Response:', result.data);
    } catch (err) {
        console.error('Error deleting all subscriptions:', err.message);
    }
})();
