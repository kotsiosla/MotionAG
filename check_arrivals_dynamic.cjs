const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const stopId = process.argv[2] || '2793';
const targetBus = process.argv[3] || '4650';

async function check() {
    console.log(`Fetching arrivals for Stop ${stopId}...`);
    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`, {
            headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
        });

        const json = await resp.json();
        const arrivals = json.data || [];

        console.log(`Found ${arrivals.length} arrivals.`);

        const relevant = arrivals.filter(a =>
            a.routeShortName === targetBus ||
            String(a.tripId).includes(targetBus) ||
            String(a.vehicleId).includes(targetBus)
        );

        if (relevant.length > 0) {
            console.log(`\n✅ FOUND Bus ${targetBus} at Stop ${stopId}:`);
            relevant.forEach(a => {
                const mins = Math.round((a.bestArrivalTime - (Date.now() / 1000)) / 60);
                console.log(`   Bus ${a.routeShortName} (Trip ${a.tripId}) in ${mins} mins (Veh: ${a.vehicleId})`);
                console.log(`   Full Details:`, JSON.stringify(a, null, 2));
            });
        } else {
            console.log(`\n❌ Bus ${targetBus} NOT FOUND at Stop ${stopId}.`);
            console.log(`Total arrivals listed: ${arrivals.map(a => `${a.routeShortName}(${a.vehicleId})`).join(', ')}`);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

check();
