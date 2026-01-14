const https = require('https');

const BASE_URL = 'https://kotsiosla.github.io/MotionAG/';

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
        console.log('Fetching index.html...');
        const html = await get(BASE_URL + 'index.html');
        // Look for script src
        const match = html.match(/src="(\/MotionAG\/assets\/index-[^"]+\.js)"/);
        if (!match) {
            console.log('❌ Bundle not found in HTML');
            console.log('HTML snippet:', html.slice(0, 500));
            return;
        }
        const bundlePath = match[1];
        console.log('Found bundle:', bundlePath);

        console.log('Fetching bundle...');
        const js = await get('https://kotsiosla.github.io' + bundlePath);

        if (js.includes('v1.5.17.2')) {
            console.log('✅ VERSION v1.5.17.2 VERIFIED');
        } else {
            console.log('❌ Version mismatch. Content sample:');
            const versionMatch = js.match(/v1\.5\.\d+(\.\d+)?/);
            console.log('Found version string:', versionMatch ? versionMatch[0] : 'NONE');
        }

        if (js.includes('SYNC_ATTEMPT')) {
            console.log('✅ SYNC_ATTEMPT logic found.');
        } else {
            console.log('❌ SYNC_ATTEMPT logic MISSING.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
