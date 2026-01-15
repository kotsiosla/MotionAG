const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('key.txt', 'utf8').trim(); // Check key.txt exists
const ENDPOINT = "https://web.push.apple.com/QOochvlwHG3ZoSH8GdYtsempEsBdYaP4QmbVjT2SuQtCMfHQTA9gTN0l3PyvgnlXioycgOBFCyEGcs_sJp4_9oBKsdjdgTydsVaudtlBKTITRVN0C-us3eKnci_1yn7cO666XXdA01vTD-YzuZzIxXOBdHpzHfuII6odsRiR0w0";

function request(path, method, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: path,
            method: method,
            headers: {
                'Authorization': 'Bearer ' + key,
                'apikey': key,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        const req = https.request(options, (res) => {
            let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        if (body) req.write(body);
        req.end();
    });
}

async function run() {
    console.log('Deleting from stop_notification_subscriptions...');
    let res = await request('/rest/v1/stop_notification_subscriptions?endpoint=eq.' + encodeURIComponent(ENDPOINT), 'DELETE');
    console.log('Stop Delete:', res.status, res.body);

    console.log('Deleting from push_subscriptions...');
    res = await request('/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(ENDPOINT), 'DELETE');
    console.log('Push Delete:', res.status, res.body);
}

run();
