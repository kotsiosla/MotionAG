const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getDetails() {
    const { data: subs, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*');

    if (error) { console.error(error); return; }

    const relevant = subs.filter(s =>
        s.stop_notifications &&
        Array.isArray(s.stop_notifications) &&
        s.stop_notifications.some(n => n.stopId === "2878" && n.enabled)
    );

    console.log(JSON.stringify(relevant, null, 2));
}

getDetails();
