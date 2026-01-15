const fs = require('fs');
const https = require('fs');

// Wait, I can't use fs as https
const https_real = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/gtfs-proxy?stopId=2793',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'apikey': key
        }
    };

    const req = https_real.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('Arrivals for Stop 2793:');
            try {
                const arrivals = JSON.parse(data);
                console.log(JSON.stringify(arrivals, null, 2));
            } catch (e) { console.log(data); }
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
