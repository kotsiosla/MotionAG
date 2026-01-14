const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    'https://jftthfniwfarxyisszjh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw'
);

async function run() {
    console.log('--- LOG VERIFICATION ---');
    const { data: logs, error } = await sb
        .from('notifications_log')
        .select('sent_at, metadata')
        .order('sent_at', { ascending: false })
        .limit(50);

    if (error) { console.error('Log Error:', error); return; }

    // 1. Version Check
    const v173 = logs.filter(l => l.metadata?.version === 'v1.5.17.3');
    console.log(`v1.5.17.3 Logs Found: ${v173.length}`);
    if (v173.length > 0) console.log('Sample:', JSON.stringify(v173[0], null, 2));

    // 2. Android Check
    const android = logs.filter(l => JSON.stringify(l).includes('Android'));
    console.log(`Android Logs Found: ${android.length}`);
    if (android.length > 0) {
        console.log('Latest Android Log:', JSON.stringify(android[0], null, 2));
        console.log('Android Version:', android[0].metadata?.version);
    } else {
        console.log('No Android logs found yet.');
    }

    // 3. Subscription Check
    console.log('\n--- SUBSCRIPTION VERIFICATION ---');
    const { data: subs, error: subError } = await sb.from('stop_notification_subscriptions').select('*');
    if (subError) { console.error('Sub Error:', subError); return; }

    const target = subs.filter(s => JSON.stringify(s.stop_notifications).includes('2793'));
    console.log(`Stop 2793 Subscriptions: ${target.length}`);
    if (target.length > 0) {
        console.log('Subscription Data:', JSON.stringify(target[0].stop_notifications, null, 2));
        console.log('Associated User:', target[0].user_id);
    } else {
        console.log('STOP 2793 NOT FOUND IN DB');
    }
}

run();
