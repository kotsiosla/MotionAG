const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`TOTAL SUBS: ${data.length}`);
    const matches = data.filter(sub => {
        const notifs = sub.stop_notifications || [];
        return notifs.some(n => n.stopId === '2811');
    });

    console.log(`MATCHES FOR 2811: ${matches.length}`);
    matches.forEach(sub => {
        console.log(`ID: ${sub.id} | Created: ${sub.created_at} | Updated: ${sub.updated_at}`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 40)}...`);
        console.log(`Notifs:`, JSON.stringify(sub.stop_notifications));
        console.log('---');
    });
}

run();
