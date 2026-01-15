const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function dumpRecent() {
    console.log("Dumping logs from the last 30 minutes...");

    // 30 mins ago in UTC
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .gte('sent_at', thirtyMinsAgo)
        .order('sent_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} recent entries.`);
    data.forEach(log => {
        let meta = log.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { }
        }
        console.log(`[${log.sent_at}] Route: ${log.route_id} | Stop: ${log.stop_id}`);
        console.log(`  Meta: ${JSON.stringify(meta)}`);
    });
}

dumpRecent();
