const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function findSWErrors() {
    console.log("Searching for any ERROR logs from SW (Jan 14-15)...");

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(300);

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

        const mStr = JSON.stringify(meta);
        const hasError = mStr.toLowerCase().includes("error") || mStr.toLowerCase().includes("fail");

        if (hasError) {
            console.log(`[ERROR_LOG] ${log.sent_at} | Stop: ${log.stop_id} | Route: ${log.route_id}`);
            console.log(`  Metadata: ${mStr}`);
            found++;
        }
    });

    console.log(`\nTotal error logs found: ${found}`);
}

findSWErrors();
