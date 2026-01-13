const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const targetStop = process.argv[2] || '2877';

async function check() {
    console.log(`Checking subscriptions for Stop ${targetStop}...`);

    // Fetch recently updated subscriptions (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .gt('updated_at', oneHourAgo)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    let found = 0;
    console.log(`Found ${data.length} total updated records in the last hour.`);

    data.forEach(sub => {
        if (Array.isArray(sub.stop_notifications)) {
            // Log matching subscriptions
            const matches = sub.stop_notifications.filter(n => n.stopId === targetStop);

            if (matches.length > 0) {
                found++;
                console.log(`\n✅ FOUND SUBSCRIPTION for Stop ${targetStop}`);
                console.log(`   User ID: ${sub.user_id}`);
                console.log(`   Content:`, JSON.stringify(matches, null, 2));
                console.log(`   Updated At: ${sub.updated_at}`);
            }
            // Also log *any* content to see if we missed filters
            // console.log("   Row content:", JSON.stringify(sub.stop_notifications));
        }
    });

    if (found === 0) {
        console.log(`\n❌ Found 0 active subscriptions for Stop ${targetStop} in the last hour.`);
    }
}

check();
