const fs = require('fs');
const https = require('https');

const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';
const targetId = '59b84e3b-cfed-4ffe-b861-513d25f0e5ad';

const options = {
    hostname: 'jftthfniwfarxyisszjh.supabase.co',
    path: `/rest/v1/stop_notification_subscriptions?id=eq.${targetId}&select=*`,
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
            const subs = JSON.parse(data);
            console.log(JSON.stringify(subs, null, 2));
        } catch (e) {
            console.log("Raw Response:", data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
