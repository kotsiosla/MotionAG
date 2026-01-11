const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('key.txt', 'utf8').trim();
const endpoint = "https://web.push.apple.com/QCxXpwW2PvYlVrDq7qXT9mw0gGY5h1i1vlwvHW7byc1Of4OniOn2Ac9WEKkQOXis8vLfudkHZm3T22jpdvQpLe9c_CkZGDNJ8fdZO5a4talMUCwAO6rFdEdf3aSPsGmhiU7gxikv1tHV6xIpmGF-x0IOZsm6gOu0za5MwhP4ZoU";
const p256dh = "BFx/ZWI/LD8P3Uq66AB+cJmYryXtpm3kDOFd4DFhThmL22yQktDDOJZBxvWk3mVjviyNyx/GuhyW9IzeO3yrT50=";
const auth = "/i1O8kU5De+9g/01ny57ig==";

const payload = JSON.stringify({
    title: "🚌 Λεωφορείο 4650",
    body: "Πλησιάζει στη στάση 2811 (6 λεπτά)!",
    icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
    url: "/MotionAG/"
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
        endpoint,
        keys: { p256dh, auth }
    },
    message: payload
}));
req.end();
