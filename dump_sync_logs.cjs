const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpLogs() {
    console.log('Fetching SYNC_DEBUG logs...');
    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('stop_id', 'SYNC_DEBUG')
        .order('sent_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} logs.`);
    data.forEach(log => {
        console.log(`[${log.sent_at}] Step: ${log.metadata?.step}`);
        console.log(`  User: ${log.metadata?.userId || 'N/A'}`);
        console.log(`  End:  ...${log.metadata?.endpoint || 'N/A'}`);
        console.log(`  Count: ${log.metadata?.count ?? log.metadata?.notifs ?? 'N/A'}`);
        if (log.metadata?.error) console.log(`  Error: ${log.metadata.error.message || JSON.stringify(log.metadata.error)}`);
        console.log('---');
    });
}

dumpLogs();
