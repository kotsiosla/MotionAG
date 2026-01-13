const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    // We might not have a stops table with names readily available if it's in GTFS only.
    // But let's check the 'stops' table if it exists or try to infer from logs if possible.
    // Actually, usually stops are not in a simple table in this architecture (fetched from API).
    // Let's try to check the live arrivals proxy for name.

    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=341`, {
            headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
        });
        const json = await resp.json();
        // The endpoint might return stop name in the structure?
        // Usually it returns list of buses.

        console.log("Arrivals Data Sample:", JSON.stringify(json.data?.[0] || {}, null, 2));
    } catch (e) {
        console.log("Error:", e);
    }
}

check();
