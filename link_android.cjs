const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('key.txt', 'utf8').trim();

// Android Sub ID from previous dump: 0fe08f03-bfe7-432e-a9d7-6b461290bbf0
// Keys from previous dump
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/ekiWKBJUx74:APA91bE79EHDkxJml1bd22pZImrA735yM-tbulywPQkVJoyGcORQwI-XWXFC7jrAQx3XGKgmlFRxqpx5i4Oy7Nb86li5ntzHhoTJWEmrr_1EcAdyzz91_HZSPPUEDVh2r7K_LEQ8OoUq";
const AUTH = "ZZ/NRZql5v/0XpmcqMibDw==";
const P256DH = "BAtYyv47WdT9XeNvbe3bE0MHfGEJ+mj3o1TWd6zOpIWo//bPkSsPTLhC0FcHCo9PXyrG0TaRFUAYacJjvEGK1Sc=";

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
    const payload = {
        endpoint: ENDPOINT,
        p256dh: P256DH,
        auth: AUTH,
        stop_notifications: [{
            stopId: '2811',
            stopName: 'Debug Link',
            enabled: true,
            push: true,
            beforeMinutes: 5
        }],
        updated_at: new Date().toISOString()
    };

    console.log('Upserting Android link...');
    const res = await request('/rest/v1/stop_notification_subscriptions?on_conflict=endpoint', 'POST', JSON.stringify(payload));
    console.log('Result:', res.status, res.body);
}

run();
