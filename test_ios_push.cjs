const https = require('https');

// Service role key (already known)
const key = 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';

// Subscription details (latest Apple endpoint)
const sub = {
    endpoint: 'https://web.push.apple.com/QAtdUiVr0R7WBNQAX1VC-lSMiBM1dGROcakNtc1dJKYd6eNucLa+SeOU4Tg=',
    p256dh: 'iBM1dGROcakNtc1dJKYd6eNucLa+SeOU4Tg=',
    auth: 'zbA3W3pOrqQOsomEM6TxgA=='
};

const payload = JSON.stringify({
    title: '🚌 iOS Test Alert',
    body: 'This is a test push notification for iOS device.',
    icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png'
});

const options = {
    hostname: 'jftthfniwfarxyisszjh.supabase.co',
    path: '/functions/v1/test-push',
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        try {
            console.log('Response:', JSON.parse(data));
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});

req.write(JSON.stringify({
    subscription: {
        endpoint: sub.endpoint,
        keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
        }
    },
    message: payload
}));
req.end();
