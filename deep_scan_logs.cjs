const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    console.log(`Searching for logs since ${twentyMinsAgo}...`);

    const { data: logs, error } = await supabase
        .from('notifications_log')
        .select('*')
        .gt('sent_at', twentyMinsAgo)
        .order('sent_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (logs.length === 0) {
        console.log("❌ NO LOGS FOUND in the last 20 minutes.");
    } else {
        logs.forEach(l => {
            console.log(`[${l.sent_at}] ${l.route_id} | ${l.stop_id} | ${JSON.stringify(l.metadata)}`);
        });
    }

    console.log("\nChecking for subscriptions...");
    const { data: subs, error: subError } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .gt('updated_at', twentyMinsAgo);

    if (subError) console.error(subError);
    if (subs && subs.length > 0) {
        console.log(`✅ FOUND ${subs.length} SUBSCRIPTIONS!`);
        subs.forEach(s => console.log(`Endpoint: ${s.endpoint.substring(0, 30)}... | Updated: ${s.updated_at}`));
    } else {
        console.log("❌ NO SUBSCRIPTIONS FOUND in the last 20 minutes.");
    }
}

check();
