const https = require('https');

const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

async function check() {
    console.log('--- Inspecting Raw Push Subscription ---');
    const id = '10565c8d-ef4d-4b98-b567-85f572ea0a65';
    const url = new URL(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}&select=*`);

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
                const json = JSON.parse(data);
                if (json.length > 0) {
                    console.log('Raw Subscription Data:', JSON.stringify(json[0], null, 2));
                } else {
                    console.log('❌ Subscription ID not found in push_subscriptions table.');
                }
            } catch (e) { console.log('Error parsing:', data); }
        });
    });
    req.end();
}

check();
