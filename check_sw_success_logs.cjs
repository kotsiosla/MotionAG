const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function findSWLogs() {
    console.log("Searching for PUSH_RECEIVED logs from Jan 14-15...");

    // Broad search for any meta containing PUSH_RECEIVED
    // Note: Since I can't filter deeply on JSON with simple select, I'll fetch and filter locally.
    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(200);

    if (error) {
        console.error(error);
        return;
    }

    let found = 0;
    data.forEach(log => {
        let meta = log.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { }
        }

        if (meta && meta.step === 'PUSH_RECEIVED') {
            console.log(`[SW_SUCCESS] ${log.sent_at} | Stop: ${log.stop_id} | Route: ${log.route_id}`);
            console.log(`  Version: ${meta.version} | Timestamp: ${meta.timestamp}`);
            found++;
        }
    });

    console.log(`\nTotal SW success logs found: ${found}`);
}

findSWLogs();
