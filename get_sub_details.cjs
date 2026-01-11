const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('id', 'f6c06200-ca7d-43db-bab2-bdd65d1bcf7f')
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`DETAILS FOR f6c06200:`);
    console.log(JSON.stringify(data, null, 2));
}

run();
