const fs = require('fs');
const https = require('https');

try {
    // Read key
    let key = '';
    const envContent = fs.readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
    envContent.split(/\r?\n/).forEach(line => {
        if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) {
            key = line.split('=')[1].trim();
        }
    });

    if (!key) throw new Error('Key not found');

    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/verify-db',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json'
        }
    };

    console.log('Calling verify-db...');

    const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                console.log('RESULT:', JSON.stringify(json, null, 2));
            } catch (e) {
                console.log('Response:', data);
            }
        });
    });
    req.end();
} catch (e) { console.error(e); }
