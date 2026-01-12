const fs = require('fs');

try {
    const buffer = fs.readFileSync('sub_android.json');
    let content = buffer.toString('utf8');
    if (content.indexOf('\0') !== -1) content = buffer.toString('utf16le');

    const lines = content.split(/\r?\n/);
    let found = false;

    for (const line of lines) {
        if (line.includes('SUBSCRIPTION_DETAILS:')) {
            const jsonStr = line.split('SUBSCRIPTION_DETAILS:')[1].trim();
            try {
                const sub = JSON.parse(jsonStr);

                const vapidPublic = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';
                const vapidPrivate = 'ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk';

                // Construct proper JSON payload for Android
                const payload = JSON.stringify({
                    title: "Android Test 🤖",
                    body: "Welcome to Motion Bus on Android!",
                    icon: "https://kotsiosla.github.io/MotionAG/pwa-192x192.png",
                    url: "https://kotsiosla.github.io/MotionAG/"
                });

                // Escape double quotes for shell arguments
                const safePayload = payload.replace(/"/g, '\\"');

                const cmd = `npx web-push send-notification --endpoint="${sub.endpoint}" --key="${sub.p256dh}" --auth="${sub.auth}" --vapid-subject="mailto:admin@motionbus.ai" --vapid-pubkey="${vapidPublic}" --vapid-pvtkey="${vapidPrivate}" "${safePayload}"`;

                console.log(cmd);
                found = true;
                break;
            } catch (e) {
                console.error("JSON PARSE ERROR:", e.message);
            }
        }
    }

    if (!found) {
        console.log("PATTERN NOT FOUND");
    }

} catch (e) {
    console.error("SCRIPT ERROR:", e.message);
}
