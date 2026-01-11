const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read keys
const envPath = path.resolve('.env');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
    content.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
            if (key === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseKey = val;
        }
    });
}

if (!supabaseUrl || !supabaseKey) {
    console.log('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log(`Checking DB for Stop 2877...`);

    // Try to fetch ANY subscription for this stop
    // Note: RLS usually prevents seeing other users' data, 
    // so this might return empty unless we are the user (which we aren't) or if RLS is off.
    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .eq('stop_id', '2877');

    if (error) {
        console.error('DB_ERROR:', error);
    } else {
        console.log(`FOUND_ENTRIES: ${data.length}`);
        if (data.length > 0) {
            console.log('SAMPLE:', data[0]);
        } else {
            console.log('No entries found (RLS likely hiding them).');
        }
    }
}

check();
