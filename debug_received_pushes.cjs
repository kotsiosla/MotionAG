const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkReceivedPushes() {
    console.log("Checking for PUSH_RECEIVED logs from devices...");
    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('metadata->>step', 'PUSH_RECEIVED')
        .order('sent_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log(`Found ${data.length} received push logs:`);
    data.forEach(log => {
        console.log(`[${log.sent_at}] Stop: ${log.stop_id} | Route/Trip: ${log.route_id} | SW Version: ${log.metadata?.version}`);
    });
}

checkReceivedPushes();
