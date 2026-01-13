const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log("Fetching latest DIAGNOSTIC_V2 logs...");

    const { data: logs, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('route_id', 'DIAGNOSTIC_V2')
        .order('sent_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    logs.forEach(l => {
        console.log(`\nTIMESTAMP: ${l.sent_at}`);
        console.log(`METADATA: ${JSON.stringify(l.metadata, null, 2)}`);
    });
}

check();
