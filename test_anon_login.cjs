const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
// This is the extracted ANON KEY from the bundle
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
    console.log("Testing Anonymous Login...");
    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
            console.error("❌ Login Failed:", error.message);
            if (error.message.includes("Anonymous sign-ins are disabled")) {
                console.error("ROOT CAUSE FOUND: Anonymous Auth is disabled!");
            }
        } else {
            console.log("✅ Login Success!");
            console.log("User ID:", data.user.id);
            console.log("Is Anonymous:", data.user.is_anonymous);

            // Try to INSERT a log to confirm RLS allows it
            console.log("Testing INSERT permission...");
            const { error: insertError } = await supabase.from('notifications_log').insert({
                stop_id: 'TEST_ANON',
                route_id: 'TEST',
                alert_level: 0,
                metadata: { source: 'test_anon_login.cjs' }
            });

            if (insertError) console.error("❌ INSERT Failed:", insertError.message);
            else console.log("✅ INSERT Success!");
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

test();
