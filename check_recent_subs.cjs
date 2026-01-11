const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.resolve('.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();

    if (!urlMatch || !serviceKey) {
        console.error('Missing credentials');
        return;
    }

    const supabase = createClient(urlMatch[1].trim(), serviceKey);

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`FOUND ${data.length} RECENT SUBS`);
    data.forEach(sub => {
        console.log(`ID: ${sub.id}`);
        console.log(`Created: ${sub.created_at}`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 50)}...`);
        console.log(`Notifications:`, JSON.stringify(sub.stop_notifications, null, 2));
        console.log('---');
    });
}

run();
