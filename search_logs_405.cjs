const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function find405() {
    console.log("Searching for entries from Jan 14 (20:00 - 23:59 UTC)...");

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .gte('sent_at', '2026-01-14T20:00:00Z')
        .lte('sent_at', '2026-01-14T23:59:59Z')
        .order('sent_at', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} entries.`);
    data.forEach(log => {
        let meta = log.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { }
        }

        const time = log.sent_at;
        const is405 = String(log.route_id).includes("405") || JSON.stringify(meta).includes("405");

        // Match 21:10 - 21:25 UTC (approx 23:10 - 23:25 local)
        const isTargetTime = time.includes("21:1") || time.includes("21:20") || time.includes("21:21") || time.includes("21:22") || time.includes("21:23") || time.includes("21:24") || time.includes("21:25");

        if (isTargetTime || is405) {
            console.log(`[${time}] Route: ${log.route_id} | Stop: ${log.stop_id}`);
            console.log(`  Metadata: ${JSON.stringify(meta)}`);
        }
    });
}

find405();
