const fs = require('fs');
const https = require('https');

// Read keys and sub
const key = fs.readFileSync('key.txt', 'utf8').trim();
// User sub from Step 3337
const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/cGP5ZI-xnPE:APA91bF6AjC7ulbll1E8SSaUqyFOnTA3lhzWIdpkSkyX10N5dfJiaNmmuY-IOhpSjkWRdvO_qoQFjE6LCEXgwme1xefpI0EW3ibSVMneDXw9fQUHcxmPcgA3Q0X8S6gXciUCLYQSildw",
    p256dh: "BD3B5JwJo6UlnOW2ytjdvIFqlb4QhUJVOHZKq7f1yiLavqVGHEu45tefY6J2m/rhoThayVYg9FxviytP8dYBClA=",
    auth: "8gqkbqc0OktVx21s2MBDhA=="
};

const payload = JSON.stringify({
    title: "🚌 Test Manual Alert",
    body: "This is a direct test for Bus 4650",
    icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png"
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
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`RESPONSE: ${data}`);
    });
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
