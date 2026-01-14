const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    'https://jftthfniwfarxyisszjh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw'
);

async function run() {
    console.log('Checking recent log versions...');
    const { data: logs, error } = await sb
        .from('notifications_log')
        .select('sent_at, metadata')
        .order('sent_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Error:', error);
        return;
    }

    const counts = {};
    logs.forEach(l => {
        const v = l.metadata?.version || 'unknown';
        counts[v] = (counts[v] || 0) + 1;
    });

    console.log('Version Distribution (Last 30 logs):', counts);

    const latest = logs[0];
    if (latest) {
        console.log('Most recent log:', latest.sent_at, latest.metadata?.version, latest.metadata?.step);
    } else {
        console.log('No logs found.');
    }
}

run();
