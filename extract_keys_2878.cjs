const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getKeys() {
    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .eq('id', '558a9f15-bd5c-4cc9-a766-f44838bf4267')
        .single();

    if (error) { console.error(error); return; }

    const out = {
        endpoint: subs.endpoint,
        auth: subs.auth,
        p256dh: subs.p256dh
    };
    require('fs').writeFileSync('keys_dump.json', JSON.stringify(out, null, 2));
    console.log("Written to keys_dump.json");
}

getKeys();
