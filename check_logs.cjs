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

    // 2. Sync Check
    const v4Logs = logs.filter(l => JSON.stringify(l).includes('v1.5.17.4'));
    console.log('v1.5.17.4 Log Count:', v4Logs.length);
    if (v4Logs.length > 0) {
        console.log('Latest v1.5.17.4 Log:', JSON.stringify(v4Logs[0], null, 2));
    } else {
        console.log('Latest Log (Any Version):', JSON.stringify(logs[0] || 'NONE', null, 2));
    }
    // Original Sync Check (kept for context, but the instruction implies replacement or addition)
    const syncs = logs.filter(l => l.metadata?.step?.includes('SYNC'));
    console.log(`SYNC Logs Found: ${syncs.length}`);
    if (syncs.length > 0) {
        console.log('Latest Sync:', JSON.stringify(syncs[0], null, 2));
    } else {
        console.log('NO SYNC LOGS FOUND (Critical)');
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
