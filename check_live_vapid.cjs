const https = require('https');

const LIVE_URL = 'https://kotsiosla.github.io/MotionAG/';

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

(async () => {
    try {
        console.log("Fetching index.html...");
        const html = await get(LIVE_URL + 'index.html');
        const match = html.match(/src="(\/MotionAG\/assets\/index-[^"]+\.js)"/);

        if (!match) {
            console.error("Could not find bundle script.");
            return;
        }

        const bundleUrl = 'https://kotsiosla.github.io' + match[1];
        console.log("Fetching bundle:", bundleUrl);

        const js = await get(bundleUrl);

        // Look for VAPID key pattern (starts with B...) and reasonable length ~87 chars
        // The one we've been using starts with BG5V
        const regex = /"([A-Za-z0-9\-_]{87})"/g;
        let found = false;
        let m;
        while ((m = regex.exec(js)) !== null) {
            const key = m[1];
            // Filter likely candidates (starts with B is common for uncompressed EC points, but not always)
            // Just print all candidates
            console.log("Found potential Key:", key);
            if (key.startsWith("BG5V")) {
                console.log(" >> MATCHES KNOWN KEY");
                found = true;
            }
        }

        if (!found) {
            console.log("Did not find the specific BG5V key in the bundle.");
        }

    } catch (e) {
        console.error(e);
    }
})();
