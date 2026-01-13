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
        const html = await fetch(URL + 'index.html?t=' + Date.now());

        // Find the main module script
        // <script type="module" crossorigin src="/MotionAG/assets/index-CX...js"></script>
        const match = html.match(/src="([^"]+index-[^"]+\.js)"/);

        if (!match) {
            console.log("❌ Could not find main JS bundle in index.html");
            return;
        }

        const bundleUrl = 'https://kotsiosla.github.io' + match[1];
        console.log(`Found Bundle: ${bundleUrl}`);

        const bundle = await fetch(bundleUrl);

        // Check for the change: "push-worker.js"
        if (bundle.includes("push-worker.js")) {
            console.log("✅ VERIFIED: Bundle contains 'push-worker.js'");
            console.log("🚀 v1.5.8 is LIVE!");
        } else if (bundle.includes("sw.js")) {
            console.log("⚠️ STILL OLD: Bundle still points to 'sw.js'");
            console.log("⏳ v1.5.8 is NOT live yet.");
        } else {
            console.log("❓ UNKNOWN: Could not find SW registration code.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

verify();
