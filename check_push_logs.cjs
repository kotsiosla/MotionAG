const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentPushes() {
    console.log('Fetching 20 most recent logs (excluding SYNC_DEBUG)...');
    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .neq('stop_id', 'SYNC_DEBUG')
        .order('sent_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} recent non-sync logs.`);
    data.forEach(log => {
        const success = log.metadata?.push_success;
        const status = log.metadata?.status_code;
        const trip = log.metadata?.trip_id;
        console.log(`[${log.sent_at}] Stop: ${log.stop_id} | Route: ${log.route_id} | Trip: ${trip}`);
        console.log(`  Alert Level: ${log.alert_level}m`);
        console.log(`  Success: ${success} | Status: ${status}`);
        if (log.metadata?.error) console.log(`  Error: ${log.metadata.error}`);
        console.log('---');
    });
}

checkRecentPushes();
