const https = require('https');

const URL = 'https://kotsiosla.github.io/MotionAG/manifest.webmanifest';

function check() {
    console.log(`Fetching ${URL}...`);
    https.get(URL, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode === 200) {
            console.log("✅ OK: Manifest exists!");
        } else {
            console.log("❌ ERROR: Manifest missing (Status: " + res.statusCode + ")");
        }
    }).on('error', (e) => console.error("Error:", e.message));
}

check();
