const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    const oneHourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`Checking activity since ${oneHourAgo}...`);

    console.log("\n[1] New Stop Subscriptions:");
    const { data: stops } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .gt('updated_at', oneHourAgo);
    console.log(stops);

    console.log("\n[2] New Notification Logs:");
    const { data: logs } = await supabase
        .from('notifications_log')
        .select('*')
        .gt('sent_at', oneHourAgo)
        .order('sent_at', { ascending: false });

    if (logs && logs.length > 0) {
        logs.forEach(l => console.log(`${l.sent_at} - ${l.route_id}: ${JSON.stringify(l.metadata)}`));
    } else {
        console.log("No recent logs.");
    }
}

check();
