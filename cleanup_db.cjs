const { createClient } = require('@supabase/supabase-js');

// Load env vars from process (or hardcode for this debugging session)
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";
const KEY = SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, KEY);

const TARGET_ENDPOINT_SUFFIX = "0lPFvxyUWt";

async function run() {
    console.log(`Searching for subscriptions ending in ${TARGET_ENDPOINT_SUFFIX}...`);

    // Fetch all to find the full endpoint
    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*');

    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    const targetSub = subs.find(s => s.endpoint.endsWith(TARGET_ENDPOINT_SUFFIX));

    if (!targetSub) {
        console.log("No matching subscription found.");
        return;
    }

    console.log("Found victim:", targetSub.id, targetSub.endpoint);

    // Delete it
    const { error: delError } = await supabase
        .from('stop_notification_subscriptions')
        .delete()
        .eq('id', targetSub.id);

    if (delError) {
        console.error("Delete failed:", delError);
    } else {
        console.log("✅ DELETED successfully.");
    }
}

run();
