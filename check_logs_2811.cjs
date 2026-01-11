const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('stop_id', '2811')
        .order('sent_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`LOGS FOR STOP 2811:`);
    data.forEach(log => {
        console.log(`Time: ${log.sent_at} | Route: ${log.route_id} | PhoneEnd: ${log.endpoint ? log.endpoint.substring(0, 10) : 'N/A'}`);
    });
}

run();
