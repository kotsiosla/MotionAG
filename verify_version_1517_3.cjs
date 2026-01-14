const https = require('https');

const LIVE_URL = 'https://kotsiosla.github.io/MotionAG/';
const VERSION_CHECK = 'v1.5.17.3';

console.log(`Verifying deployment for ${VERSION_CHECK}...`);

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`Status ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function check() {
    try {
        const html = await get(LIVE_URL + 'index.html');
        const match = html.match(/src="(\/MotionAG\/assets\/index-[^"]+\.js)"/);
        if (!match) {
            console.error('❌ Could not find bundle hash in HTML');
            return;
        }
        const bundlePath = match[1];
        console.log(`📦 Found bundle: ${bundlePath}`);

        const js = await get('https://kotsiosla.github.io' + bundlePath);

        if (js.includes(VERSION_CHECK)) {
            console.log(`✅ Found version string "${VERSION_CHECK}" in live bundle!`);
        } else {
            console.error(`❌ Version string "${VERSION_CHECK}" NOT found.`);
        }

        if (js.includes('getRegistrations') && js.includes('SYNC_START')) {
            console.log(`✅ Found "getRegistrations" and "SYNC_START" logic in bundle.`);
        } else {
            console.error(`❌ New logic seems MISSING.`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
