const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function wipe() {
    console.log("⚠️ STARTING FULL SERVER WIPE...");

    // 1. Wipe subscriptions
    const { count: countSubs, error: errSubs } = await supabase
        .from('stop_notification_subscriptions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all where id is not zero (all UUIDs)

    if (errSubs) console.error("❌ Failed to wipe subscriptions:", errSubs.message);
    else console.log(`✅ Wiped Subscriptions table.`);

    // 2. Wipe logs
    const { count: countLogs, error: errLogs } = await supabase
        .from('notifications_log')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (errLogs) console.error("❌ Failed to wipe logs:", errLogs.message);
    else console.log(`✅ Wiped Logs table.`);

    console.log("🏁 SERVER CLEAN.");
}

wipe();
