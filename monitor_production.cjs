const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log(`[${new Date().toISOString()}] Checking remote logs...`);

    // Get logs from the last 15 minutes (using sent_at)
    const timeWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .gt('sent_at', timeWindow)
        .order('sent_at', { ascending: false }) // Use sent_at
        .limit(10);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (data.length > 0) {
        console.log("🔥 RECENT LOGS FOUND (Last 15m):");
        data.forEach(log => {
            console.log(`[${log.sent_at}] Stop ${log.stop_id} | Route ${log.route_id} (Level ${log.alert_level}) | Meta: ${JSON.stringify(log.metadata)}`);
        });
    } else {
        console.log("No logs in last 15m.");
    }
}

// Run immediately then loop
check();
setInterval(check, 10000);
