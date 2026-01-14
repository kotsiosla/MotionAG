const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    'https://jftthfniwfarxyisszjh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw'
);

async function run() {
    console.log('Probing stop_notification_subscriptions schema...');

    const testId = 'test_' + Date.now();

    console.log('--- Attempt 1: Insert WITH user_id ---');
    const { error: err1 } = await sb
        .from('stop_notification_subscriptions')
        .insert({
            endpoint: 'https://test.com/' + testId,
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            p256dh: 'test',
            auth: 'test'
        });

    if (err1) {
        console.log('❌ FAILED:', err1.message);
    } else {
        console.log('✅ SUCCEEDED (user_id exists)');
        // Cleanup
        await sb.from('stop_notification_subscriptions').delete().eq('endpoint', 'https://test.com/' + testId);
    }

    console.log('\n--- Attempt 2: Insert WITHOUT user_id ---');
    const { error: err2 } = await sb
        .from('stop_notification_subscriptions')
        .insert({
            endpoint: 'https://test.com/' + testId + '_2',
            p256dh: 'test',
            auth: 'test'
        });

    if (err2) {
        console.log('❌ FAILED:', err2.message);
    } else {
        console.log('✅ SUCCEEDED (user_id optional/missing)');
        // Cleanup
        await sb.from('stop_notification_subscriptions').delete().eq('endpoint', 'https://test.com/' + testId + '_2');
    }
    console.log('\n--- Attempt 3: Insert with stop_notifications ---');
    const { error: err3 } = await sb
        .from('stop_notification_subscriptions')
        .insert({
            endpoint: 'https://test.com/' + testId + '_3',
            p256dh: 'test',
            auth: 'test',
            // This was the old key name
            stop_notifications: []
        });

    if (err3) {
        console.log('❌ FAILED (stop_notifications):', err3.message);
    } else {
        console.log('✅ SUCCEEDED (stop_notifications exists)');
        await sb.from('stop_notification_subscriptions').delete().eq('endpoint', 'https://test.com/' + testId + '_3');
    }

    console.log('\n--- Attempt 4: Insert with notification_settings ---');
    const { error: err4 } = await sb
        .from('stop_notification_subscriptions')
        .insert({
            endpoint: 'https://test.com/' + testId + '_4',
            p256dh: 'test',
            auth: 'test',
            // This is what failed in the app
            notification_settings: []
        });

    if (err4) {
        console.log('❌ FAILED (notification_settings):', err4.message);
    } else {
        console.log('✅ SUCCEEDED (notification_settings exists)');
        await sb.from('stop_notification_subscriptions').delete().eq('endpoint', 'https://test.com/' + testId + '_4');
    }
}

run();
