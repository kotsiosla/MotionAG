const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLiveSync() {
    console.log('Fetching most recent stop_notification_subscription...');
    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No subscriptions found.');
        return;
    }

    const sub = data[0];
    console.log(`Sub ID: ${sub.id}`);
    console.log(`Endpoint: ...${sub.endpoint.slice(-10)}`);
    console.log(`Updated At: ${sub.updated_at}`);

    const notifs = sub.stop_notifications || [];
    console.log(`Attached Notifications: ${notifs.length}`);

    notifs.forEach((n, i) => {
        console.log(`[${i}] Stop: ${n.stopName} (${n.stopId})`);
        console.log(`    Mode: ${n.notifyType || 'default'}`);
        console.log(`    Watched Trips: ${JSON.stringify(n.watchedTrips || [])}`);
        console.log(`    Push Enabled: ${n.push}`);
    });

    if (notifs.some(n => n.notifyType === 'selected')) {
        console.log('\n✅ COMPLIANCE CHECK: Found "selected" notifyType. Frontend fix is LIVE.');
    } else {
        console.log('\n⚠️ COMPLIANCE CHECK: "selected" notifyType NOT found. Did you interact with the Nearby Stops panel after refreshing?');
    }
}

verifyLiveSync();
