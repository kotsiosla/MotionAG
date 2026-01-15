const https = require('https');
const url = "https://kotsiosla.github.io/MotionAG/assets/index-B48sSIZP.js";
const req = https.get(url, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const hasOld = data.includes("notification_settings");
        const hasNew = data.includes("v1.5.17.6");
        console.log("Has notification_settings (Bug):", hasOld);
        console.log("Has v1.5.17.6 (New Version):", hasNew);
    });
});
req.on('error', e => console.log('ERR:', e.message));
req.end();
