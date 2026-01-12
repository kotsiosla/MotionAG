const fs = require('fs');
try {
    const rawPush = fs.readFileSync('latest_push.json', 'ucs2');
    // Find start of JSON array
    const start = rawPush.indexOf('[');
    if (start === -1) throw new Error("No JSON start found");
    const jsonStr = rawPush.substring(start);
    const push = JSON.parse(jsonStr)[0];

    const payload = [{
        id: push.id,
        endpoint: push.endpoint,
        p256dh: push.p256dh,
        auth: push.auth,
        stop_notifications: [{
            stopId: "2875",
            stopName: "Test Stop 2875",
            vibration: true,
            beforeMinutes: 60,
            enabled: true,
            push: true
        }]
    }];

    fs.writeFileSync('payload_fixed.json', JSON.stringify(payload, null, 2));
    console.log("Payload fixed successfully.");
    console.log("Key length:", payload[0].p256dh.length);
} catch (e) {
    console.error(e);
}
