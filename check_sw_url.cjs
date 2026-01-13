const https = require('https');

const URL = 'https://kotsiosla.github.io/MotionAG/push-worker.js';

function check() {
    console.log(`Fetching ${URL}...`);
    https.get(URL, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);

        if (res.statusCode === 200 && res.headers['content-type'].includes('javascript')) {
            console.log("✅ OK: File exists and is Javascript.");
        } else {
            console.log("❌ ERROR: File missing or wrong type.");
        }

        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => console.log(`First 50 chars: ${data.substring(0, 50)}...`));
    }).on('error', (e) => console.error("Error:", e.message));
}

check();
