const { createClient } = require('@supabase/supabase-js');

// Production Creds (from local_worker_user.cjs)
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

async function run() {
    console.log("Triggering Production Edge Function...");
    const start = Date.now();

    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/check-stop-arrivals`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ test: true })
        });

        const duration = Date.now() - start;
        console.log(`Response received in ${duration}ms`);
        console.log(`Status: ${resp.status} ${resp.statusText}`);

        const text = await resp.text();
        try {
            const data = JSON.parse(text);
            console.log("--- WORKER LOGS ---");
            if (data.logs) console.log(data.logs.join('\n'));
            if (data.errors && data.errors.length) {
                console.error("--- ERRORS ---");
                console.error(data.errors.join('\n'));
            }
            console.log("--- SUMMARY ---");
            console.log(`Total Sent: ${data.totalSent}`);
            console.log(`Message: ${data.message || 'N/A'}`);
        } catch (e) {
            console.log("Raw Body:", text);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

run();
