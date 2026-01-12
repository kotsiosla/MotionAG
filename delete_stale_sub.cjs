const https = require('https');
const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';
const subId = '81c6bf1f-6dbc-4e44-9baa-22984d04fe03'; // stale iOS subscription

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
        const options = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: `/rest/v1/stop_notification_subscriptions?id=eq.${subId}`,
            method: 'DELETE',
            headers: {
                Authorization: 'Bearer ' + key,
                apikey: key,
            },
        };
        const result = await httpsRequest(options);
        console.log('DELETE status:', result.statusCode);
        console.log('Response:', result.data);
    } catch (err) {
        console.error('Error deleting subscription:', err.message);
    }
})();
