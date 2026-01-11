const fs = require('fs');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    // Use the hostname found in check_log_table.cjs
    const projectUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
    const functionName = 'test-push'; // Targeting test-push for verification
    const url = `${projectUrl}/functions/v1/${functionName}`;

    console.log(`Testing function: ${url}`);

    const https = require('https');
    const options = {
        method: 'POST', // or GET? usually POST for functions if they take body, but serve(req) handles any
        headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(url, options, (res) => {
        let data = '';
        console.log(`Status Code: ${res.statusCode}`);
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Response Body:', data);
            try {
                const responseJson = JSON.parse(data);
                console.log('---------------------------------------------------');
                console.log(`FINAL RESULT: SENT=${responseJson.sent} | FAILED=${responseJson.failed}`);
                console.log('---------------------------------------------------');
            } catch (e) {
                console.error('Error parsing response data:', e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.end();

    console.log("Request sent...");
} catch (e) { console.error(e); }
