const https = require('https');

const URL = 'https://kotsiosla.github.io/MotionAG/manifest.webmanifest';

function check() {
    console.log(`Fetching ${URL}...`);
    https.get(URL, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        const contentType = res.headers['content-type'] || '';
        console.log(`Content-Type: ${contentType}`);

        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            // If data starts with <!, it's HTML (Fallback), NOT the JSON manifest
            if (data.trim().startsWith('<!')) {
                console.log("❌ FALSE POSITIVE: Server returned HTML (Index Page). File is NOT live yet.");
            } else if (contentType.includes('json') || contentType.includes('manifest')) {
                console.log("✅ REAL POSITIVE: Server returned JSON/Manifest.");
                console.log("Manifest Content Preview: " + data.substring(0, 100));
            } else {
                console.log("❓ UNKNOWN: " + data.substring(0, 50));
            }
        });
    }).on('error', (e) => console.error("Error:", e.message));
}

check();
