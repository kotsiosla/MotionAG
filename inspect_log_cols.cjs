const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectTable() {
    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns in notifications_log:", Object.keys(data[0]));
        console.log("Sample row:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No rows found in notifications_log");
    }
}

inspectTable();
