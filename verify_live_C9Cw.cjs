const https = require('https');
const url = "https://kotsiosla.github.io/MotionAG/assets/index-C9Cw-fpz.js";
const req = https.get(url, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const hasBug = data.includes("notification_settings");
        const hasFix = data.includes("v1.5.17.6");
        const hasUpsert = data.includes(".upsert(");
        console.log("Has notification_settings (Bug):", hasBug);
        console.log("Has v1.5.17.6 (New Version):", hasFix);
        console.log("Has .upsert (Atomic):", hasUpsert);
    });
});
req.on('error', e => console.log('ERR:', e.message));
req.end();
