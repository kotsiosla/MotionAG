const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();

    // Get latest sub ID
    const getSub = () => new Promise(resolve => {
        https.get({
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/rest/v1/stop_notification_subscriptions?select=id,endpoint&order=updated_at.desc&limit=1',
            headers: { 'Authorization': 'Bearer ' + key, 'apikey': key }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)[0]));
        });
    });

    const getLogs = () => new Promise(resolve => {
        https.get({
            hostname: 'jftthfniwfarxyisszjh.supabase.co',
            path: '/rest/v1/notifications_log?select=subscription_id,sent_at,alert_level&stop_id=eq.2792&order=sent_at.desc&limit=5',
            headers: { 'Authorization': 'Bearer ' + key, 'apikey': key }
        }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        });
    });

    (async () => {
        const sub = await getSub();
        const logs = await getLogs();
        console.log("Current Device Sub ID:", sub.id);
        console.log("Current Device Endpoint:", sub.endpoint.substring(0, 30) + "...");

        console.log("\nRecent Logs for Stop 2792:");
        logs.forEach(l => {
            console.log(`- Time: ${l.sent_at}, Level: ${l.alert_level}, SubID: ${l.subscription_id}, MATCH: ${l.subscription_id === sub.id}`);
        });
    })();
} catch (e) { console.error(e); }
