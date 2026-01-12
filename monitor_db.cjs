const https = require('https');

const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

async function check() {
    // process.stdout.write('\x1Bc'); // Clear console (Disabled for history)
    console.log('--- 🔍 LIVE NOTIFICATION MONITOR ---');
    console.log('Time:', new Date().toLocaleTimeString());

    const fetchData = (path) => new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
        const req = https.request(url, {
            method: 'GET',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });

    try {
        // 1. Check Subscriptions
        const subs = await fetchData('push_subscriptions?select=*&order=created_at.desc&limit=3');
        console.log('\n📌 Recent Subscriptions:');
        if (Array.isArray(subs)) {
            subs.forEach(s => {
                console.log(`   - ID: ${s.id}`);
                console.log(`     Endpoint: ${s.endpoint ? s.endpoint.slice(0, 40) + '...' : 'N/A'}`);
                // console.log(`     P256DH: ${s.p256dh}`); // Hide details to reduce noise
                // console.log(`     Auth: ${s.auth}`);
                console.log(`     Routes: ${JSON.stringify(s.route_ids)}`);
                console.log(`     Created: ${s.created_at}`);
            });
        }

        // 2. Check Logs
        const logs = await fetchData('notifications_log?select=*&order=created_at.desc&limit=10');
        console.log('\n🔔 Recent Notifications (Last 5):');
        if (Array.isArray(logs)) {
            logs.forEach(l => {
                const time = new Date(l.created_at || l.timestamp).toLocaleTimeString();
                console.log(`   [${time}] ${JSON.stringify(l)}`);
            });
        } else {
            console.log('   (Log info:', logs, ')');
        }

    } catch (e) {
        console.error('\n❌ Monitor Error:', e.message);
    }
}

check();
setInterval(check, 10000);
