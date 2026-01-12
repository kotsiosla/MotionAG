const fs = require('fs');
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

async function fetchJson(url) {
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY } });
    return await resp.json();
}

(async () => {
    try {
        const payload = JSON.parse(fs.readFileSync('payload_fixed.json', 'utf8'))[0];
        console.log("Local Key:", payload.p256dh.slice(0, 20) + "..." + payload.p256dh.slice(-10));
        console.log("Local Key Len:", payload.p256dh.length);

        const subs = await fetchJson(`${SUPABASE_URL}/rest/v1/stop_notification_subscriptions?select=*&limit=10`);
        const sub = subs.find(s => s.id === payload.id);

        if (sub) {
            console.log("DB Key:   ", sub.p256dh.slice(0, 20) + "..." + sub.p256dh.slice(-10));
            console.log("DB Key Len:   ", sub.p256dh.length);
        } else {
            console.log("Sub not found in DB");
        }
    } catch (e) { console.error(e); }
})();
