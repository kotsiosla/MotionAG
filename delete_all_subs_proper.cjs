const https = require('https');
const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';

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

async function fetchAllSubscriptions() {
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/stop_notification_subscriptions?select=id',
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + key,
            apikey: key,
        },
    };
    const { data } = await httpsRequest(options);
    return JSON.parse(data);
}

async function deleteSubscription(id) {
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: `/rest/v1/stop_notification_subscriptions?id=eq.${id}`,
        method: 'DELETE',
        headers: {
            Authorization: 'Bearer ' + key,
            apikey: key,
        },
    };
    const result = await httpsRequest(options);
    console.log(`Deleted ${id}:`, result.statusCode);
}

(async () => {
    try {
        const subs = await fetchAllSubscriptions();
        if (!Array.isArray(subs) || subs.length === 0) {
            console.log('No subscriptions to delete.');
            return;
        }
        for (const { id } of subs) {
            await deleteSubscription(id);
        }
        console.log('All subscriptions deleted.');
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
