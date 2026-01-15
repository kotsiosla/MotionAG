const https = require('https');
const fs = require('fs');

async function run() {
    const key = fs.readFileSync('key.txt', 'utf8').trim(); // Ensure key.txt exists or use hardcoded anon key if needed

    // We call the test-push function directly or via a custom script that replicates the logic?
    // The previous probe script likely used the test-push function endpoint.
    // Let's assume we want to call the Supabase Edge Function 'test-push' directly? 
    // Or simpler: Inspecting the previous sessions, I might have used a direct webpush call script?
    // But since VAPID is involved, using the backend function is safer as it has the private key (supposedly).
    // However, if the backend function is using the WRONG private key, that's the issue.
    // The user's goal is to fix it.

    // Let's create a local script that uses web-push package IF INSTALLED, or just calls the edge function.
    // Calling the edge function is easier.

    const payload = JSON.stringify({
        title: "Test Probe",
        body: "Checking delivery...",
        // iOS minimal payload
        icon: "/MotionAG/pwa-192x192.png",
        data: { url: "https://kotsiosla.github.io/MotionAG/" }
    });

    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/test-push',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('STATUS:', res.statusCode);
            console.log('RESPONSE:', data);
        });
    });

    req.write(payload);
    req.end();
}

run();
