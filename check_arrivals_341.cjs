const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

async function check() {
    console.log("Fetching arrivals for Stop 341...");
    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=341`, {
            headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
        });

        const json = await resp.json();
        const arrivals = json.data || [];

        console.log(`Found ${arrivals.length} arrivals.`);
        arrivals.forEach(a => {
            const mins = Math.round((a.bestArrivalTime - (Date.now() / 1000)) / 60);
            console.log(`Bus ${a.routeShortName} (Trip ${a.tripId}) in ${mins} mins`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
}

check();
