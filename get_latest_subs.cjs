const fs = require('fs');
const https = require('https');

const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0'; // Using the key from previous session

const options = {
    hostname: 'jftthfniwfarxyisszjh.supabase.co',
    path: '/rest/v1/stop_notification_subscriptions?select=*&order=created_at.desc&limit=5',
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
        console.log("Response Status:", res.statusCode);
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
