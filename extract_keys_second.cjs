const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getKeys() {
    // We are looking for the OTHER sub: 6ba24...
    // Let's filter by ID starting with 6ba24
    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*');

    if (error) return;

    const target = subs.find(s => s.id.startsWith('6ba24'));

    if (target) {
        const out = {
            id: target.id,
            endpoint: target.endpoint,
            auth: target.auth,
            p256dh: target.p256dh
        };
        require('fs').writeFileSync('keys_dump_2.json', JSON.stringify(out, null, 2));
        console.log("Found: " + target.id);
    } else {
        console.log("Sub starting with 6ba24 not found");
    }
}

getKeys();
