const https = require('https');
const url = "https://kotsiosla.github.io/MotionAG/pwa-192x192.png";
const req = https.request(url, { method: 'HEAD' }, res => {
    console.log("STATUS:", res.statusCode);
});
req.on('error', e => console.log('ERROR:', e.message));
req.end();
