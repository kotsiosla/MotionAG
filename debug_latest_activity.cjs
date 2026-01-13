const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log("--- Checking Last 5 Subscriptions ---");
    const { data: subs, error: subsError } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (subsError) console.error("Subs Error:", subsError);
    else {
        subs.forEach(s => {
            console.log(`[${s.updated_at}] User: ${s.user_id} | Stop notifs: ${JSON.stringify(s.stop_notifications)}`);
        });
    }

    console.log("\n--- Checking Last 5 Logs ---");
    const { data: logs, error: logsError } = await supabase
        .from('notifications_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(5);

    if (logsError) console.error("Logs Error:", logsError);
    else {
        logs.forEach(l => {
            console.log(`[${l.sent_at}] ${l.route_id} | ${JSON.stringify(l.metadata)}`);
        });
    }
}

check();
