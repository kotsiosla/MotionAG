const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function findZ0kg() {
    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*');

    if (error) { console.error(error); return; }

    const target = subs.find(s => s.endpoint.includes('Z0kg') || s.endpoint.includes('Z6mRPCve'));

    if (target) {
        console.log("FOUND Z0kg!");
        console.log("ID:", target.id);
        const out = {
            id: target.id,
            endpoint: target.endpoint,
            auth: target.auth,
            p256dh: target.p256dh
        };
        require('fs').writeFileSync('keys_dump_z0kg.json', JSON.stringify(out, null, 2));
    } else {
        console.log("Z0kg NOT FOUND in current DB dump.");
    }
}

findZ0kg();
