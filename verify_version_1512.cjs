const https = require('https');

const URL = 'https://kotsiosla.github.io/MotionAG/';

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function verify() {
    console.log(`Checking ${URL}...`);
    try {
        const html = await fetch(URL + 'index.html?t=' + Date.now()); // Bust cache for HTML

        // Find main bundle
        const match = html.match(/src="([^"]+index-[^"]+\.js)"/);

        if (!match) {
            console.log("❌ Could not find main JS bundle.");
            return;
        }

        const bundleUrl = 'https://kotsiosla.github.io' + match[1];
        console.log(`Scanning Bundle: ${bundleUrl}`);

        const bundle = await fetch(bundleUrl);

        // Check for the unique string we added
        if (bundle.includes("v1.5.12")) {
            console.log("✅ VERIFIED: Found 'v1.5.12' in code!");
            console.log("🚀 Deployment is LIVE.");
            process.exit(0);
        } else {
            console.log("⏳ STILL OLD: 'v1.5.12' not found yet.");
            process.exit(1);
        }

    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}

verify();
