const https = require('https');
const url = 'https://kotsiosla.github.io/MotionAG/assets/index-C5FN_A6H.js';

https.get(url, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const hasBug = data.includes("notification_settings");
        const hasFix = data.includes("stop_notifications");
        const hasVersion = data.includes("v1.5.17.7");
        const hasSelect = data.includes(".select()");

        console.log("--- LIVE ASSET VERIFICATION ---");
        console.log("Asset:", url);
        console.log("Has notification_settings (Bug):", hasBug);
        console.log("Has stop_notifications (Fix):", hasFix);
        console.log("Has v1.5.17.7:", hasVersion);
        console.log("Has .select() after upsert (Risk):", hasSelect);

        // Find all upserts
        let pos = 0;
        let count = 0;
        while ((pos = data.indexOf(".upsert({", pos)) !== -1) {
            count++;
            console.log(`\n--- Upsert #${count} Context ---`);
            console.log(data.substring(pos, pos + 250));
            pos += 1;
        }

        const selectCount = (data.match(/\.select\(\)/g) || []).length;
        console.log("\nTotal .select() count in bundle:", selectCount);
    });
});
