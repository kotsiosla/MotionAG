const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`POLLING push_subscriptions:`);
    data.forEach(sub => {
        console.log(`ID: ${sub.id} | Created: ${sub.created_at}`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 40)}...`);
        console.log('---');
    });
}

run();
