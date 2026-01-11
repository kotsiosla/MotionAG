const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`FOUND ${data.length} SUBS BY UPDATE TIME`);
    data.forEach(sub => {
        console.log(`ID: ${sub.id}`);
        console.log(`Updated: ${sub.updated_at}`);
        console.log(`Created: ${sub.created_at}`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 50)}...`);
        console.log(`Notifications:`, JSON.stringify(sub.stop_notifications, null, 2));
        console.log('---');
    });
}

run();
