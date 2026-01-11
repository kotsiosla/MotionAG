const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`CHECKING LAST 10 SUBS:`);
    data.forEach(sub => {
        console.log(`ID: ${sub.id} | Created: ${sub.created_at}`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 40)}...`);
        console.log(`Notifs:`, JSON.stringify(sub.stop_notifications));
        console.log('---');
    });
}

run();
