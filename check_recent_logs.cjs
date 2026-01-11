const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`RECENT LOGS:`);
    data.forEach(log => {
        console.log(`Time: ${log.sent_at} | Route: ${log.route_id} | Stop: ${log.stop_id} | Level: ${log.alert_level}`);
    });
}

run();
