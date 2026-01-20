const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkHeartbeat() {
    console.log("Checking for activity in the last hour...");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: logs, error: logsError } = await supabase
        .from('notifications_log')
        .select('sent_at, stop_id, route_id, metadata')
        .gt('sent_at', oneHourAgo)
        .order('sent_at', { ascending: false })
        .limit(10);

    if (logsError) {
        console.error("Error fetching logs:", logsError);
    } else {
        console.log(`Found ${logs.length} (limited to 10 latest) notification logs in the last hour.`);
        logs.forEach(l => {
            const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata;
            console.log(`[${l.sent_at}] Stop: ${l.stop_id} | Route: ${l.route_id} | Step: ${meta?.step || 'N/A'}`);
        });
    }

    const { data: subs, error: subsError } = await supabase
        .from('stop_notification_subscriptions')
        .select('updated_at, id')
        .gt('updated_at', oneHourAgo)
        .order('updated_at', { ascending: false });

    if (subsError) {
        console.error("Error fetching subs:", subsError);
    } else {
        console.log(`Found ${subs.length} subscription updates in the last hour.`);
        if (subs.length > 0) {
            console.log("Latest sub update:", subs[0]);
        }
    }
}

checkHeartbeat();
