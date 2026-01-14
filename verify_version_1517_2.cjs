const fs = require('fs');
const https = require('https');

const LIVE_URL = 'https://kotsiosla.github.io/MotionAG/';
const VERSION_CHECK = 'v1.5.17.2';

console.log(`Verifying deployment for ${VERSION_CHECK}...`);

function checkBundle(html) {
    const match = html.match(/src="\/MotionAG\/assets\/index-([a-zA-Z0-9]+)\.js"/);
    if (!match) {
        // Try without base path
        const match2 = html.match(/src="\/assets\/index-([a-zA-Z0-9]+)\.js"/);
        if (!match2) return null;
        return match2[1];
    }
    return match[1];
}

https.get(LIVE_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const bundleHash = checkBundle(data);
        if (!bundleHash) {
            console.error('❌ Could not find bundle hash in HTML');
            return;
        }
        console.log(`📦 Found bundle hash: ${bundleHash}`);

        const bundleUrl = `${LIVE_URL}assets/index-${bundleHash}.js`;
        https.get(bundleUrl, (res2) => {
            let js = '';
            res2.on('data', (chunk) => js += chunk);
            res2.on('end', () => {
                if (js.includes(VERSION_CHECK)) {
                    console.log(`✅ Found version string "${VERSION_CHECK}" in live bundle!`);
                } else {
                    console.error(`❌ Version string "${VERSION_CHECK}" NOT found in bundle.`);
                    // Extract version found
                    const found = js.match(/v1\.5\.\d+(\.\d+)?/);
                    if (found) console.log(`   Found version: ${found[0]}`);
                }

                // Check for new logic usage (forceSync)
                if (js.includes('SYNC_ATTEMPT') && js.includes('STOP_NOTIFS')) {
                    console.log(`✅ Found "SYNC_ATTEMPT" diagnostics in bundle.`);
                } else {
                    console.error(`❌ "SYNC_ATTEMPT" logic NOT found.`);
                }
            });
        });
    });
}).on('error', (e) => {
    console.error('Network error:', e);
});
