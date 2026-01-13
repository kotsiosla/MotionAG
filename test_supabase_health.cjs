const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MjcyMTgsImV4cCI6MjA1MTUwMzIxOH0.6iia0S8D2k2C8_3vM6u-WIdrY1eJ05Jk8t0_MREU0G8";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
    console.log("Testing Anonymous Sign-in...");
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError) {
        console.error("❌ Auth Error:", authError.message);
        return;
    }
    console.log("✅ Auth Success! User ID:", authData.user.id);

    console.log("Testing Log Insertion...");
    const { error: logError } = await supabase.from('notifications_log').insert({
        stop_id: 'DIAGNOSTIC_TEST',
        route_id: 'HEALTH_CHECK',
        alert_level: 0,
        metadata: { status: 'OK', timestamp: new Date().toISOString() }
    });

    if (logError) {
        console.error("❌ Log Error:", logError.message);
    } else {
        console.log("✅ Log Insertion Success!");
    }
}

test();
