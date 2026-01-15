const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('key.txt', 'utf8').trim(); // Anon key

// Data from user's latest push_subscriptions entry
const ENDPOINT = "https://web.push.apple.com/QBNXHjVJK9Q3jStAxMh1peubDdavJ1gnfoSFL-iMFBRTCcovWT54P5_QpQjKhXJU5_bjDVXdU9FcLOUm2IekYYbmN1tTDLrwalU53Kwr3ud3nKJLezB2SG8cXcnP-Ip-F-tQLqgVF_okcTurgA7A2epCqpcvb0jy4s7oud9Zvns";
const P256DH = "BES+xihuylJp6JGpb2WveX9Di4NR7/sNWJtHhhTT++KpqExNoNZw3NtEXp1qQiVtUb6GNSV5vVOKdXmmrVr/WPM=";
const AUTH = "HojW31z2ABUf3hOFM6wWQw==";

// Frontend payload structure
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
    console.log('Simulating StopNotificationModal upsert...');
    // matches StopNotificationModal: supabase.from(...).upsert(..., { onConflict: 'endpoint' })
    // REST: POST /stop_notification_subscriptions?on_conflict=endpoint
    const res = await request('/rest/v1/stop_notification_subscriptions?on_conflict=endpoint', 'POST', JSON.stringify(payload));

    console.log('Status:', res.status);
    console.log('Body:', res.body);
}

run();
