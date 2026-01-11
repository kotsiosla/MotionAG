const fs = require('fs');
const https = require('https');

try {
    let key = '';
    const envContent = fs.readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
    envContent.split(/\r?\n/).forEach(line => {
        if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) {
            key = line.split('=')[1].trim();
        }
    });

    if (!key) throw new Error('Key not found');

    // We need to use the SERVICE_ROLE_KEY to invoke this function properly 
    // because typically these background functions are protected. 
    // HOWEVER, the viewing of .env earlier showed only anon key. 
    // The function code checks `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` internally but 
    // usually allows invocation with anon key if RLS allows or if it's public. 
    // Looking at the code: `serve(async (req) => { ... })`. It doesn't explicitly check Authorization header for a specific role, 
    // but Supabase Gateway might. 
    // Let's try with the Anon Key first. If 401, we know why.

    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/check-stop-arrivals',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json'
        }
    };

    console.log('Triggering check-stop-arrivals...');

    const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                console.log('RESPONSE:', JSON.stringify(json, null, 2));
            } catch (e) {
                console.log('RESPONSE:', data);
            }
        });
    });

    req.write(JSON.stringify({}));
    req.end();

} catch (e) { console.error(e); }
