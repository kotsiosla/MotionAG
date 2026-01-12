const https = require('https');

const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE';

async function sendHello() {
    console.log('--- Sending Manual HELLO WORLD ---');
    const subId = '0b2f15ce-e87f-487d-a09f-e20d91a1e0a3'; // User's latest ID

    // We can use the test-push function if it exists, or manually invoke a push
    // But since we want to be sure it works with the REAL keys, let's try to mimic the payload
    // Actually, let's just use the 'test-push' function endpoint which was fixed earlier?
    // Wait, the user asked to send it to "this mobile". 
    // Let's use the 'send-test-push' function if available, or just construct a raw push.

    // Simpler: Trigger the check-stop-arrivals with a fake force? No that's complex.
    // Let's use the documented 'test-push' function.

    const payload = JSON.stringify({
        subscription_id: subId,
        message: "Hello World! 🌍 bus is coming!"
    });

    const url = new URL(`${SUPABASE_URL}/functions/v1/test-push`);
    const req = https.request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Response:', data);
        });
    });

    req.write(payload);
    req.end();
}

sendHello();
