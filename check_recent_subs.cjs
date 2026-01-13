const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log("Checking recent subscriptions (last 1 hour)...");

    // Get time 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .gt('updated_at', oneHourAgo) // Assuming updated_at is maintained
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${subs.length} recently updated subscriptions.`);
    subs.forEach(s => {
        console.log(`[${s.updated_at}] ID: ${s.id.slice(0, 5)}... | Endpoint: ${s.endpoint.slice(-10)}`);
        console.log(`   Data: ${JSON.stringify(s.stop_notifications)}`);
    });
}

check();
