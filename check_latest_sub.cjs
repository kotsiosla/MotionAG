const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkLatest() {
    console.log("Checking for recent subscriptions...");

    // Check stop_notification_subscriptions
    const { data: stopSubs, error: err1 } = await supabase
        .from('stop_notification_subscriptions')
        .select('id, created_at, endpoint')
        .order('created_at', { ascending: false })
        .limit(3);

    if (stopSubs && stopSubs.length > 0) {
        console.log("Latest Stop Subscriptions:");
        stopSubs.forEach(s => console.log(`- ${s.created_at} | ID: ${s.id} | Endpoint: ...${s.endpoint.slice(-10)}`));
    }

    // Check push_subscriptions (general)
    const { data: pushSubs, error: err2 } = await supabase
        .from('push_subscriptions')
        .select('id, created_at, endpoint')
        .order('created_at', { ascending: false })
        .limit(3);

    if (pushSubs && pushSubs.length > 0) {
        console.log("Latest Push Subscriptions:");
        pushSubs.forEach(s => console.log(`- ${s.created_at} | ID: ${s.id} | Endpoint: ...${s.endpoint.slice(-10)}`));
    }
}

checkLatest();
