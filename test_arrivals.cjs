const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const stopId = process.argv[2] || '2877';

    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: `/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`,
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Accept': 'application/json'
        }
    };

    console.log(`Fetching arrivals for Stop ${stopId}...`);

    const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        let data = '';

        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    const arrivals = json.data || [];
                    console.log(`ARRIVALS_COUNT: ${arrivals.length}`);

                    if (arrivals.length > 0) {
                        console.log('--- ALL ARRIVALS ---');
                        arrivals.forEach(a => {
                            const now = Date.now() / 1000;
                            const eta = Math.round((a.bestArrivalTime - now) / 60);
                            const vehicle = a.vehicleId || a.vehicleLabel || '?';
                            console.log(`Route ${a.routeId} (${vehicle}) - ${eta} min [${a.source}]`);
                        });
                    } else {
                        console.log('NO_ARRIVALS_FOUND');
                    }
                } catch (e) {
                    console.log('JSON_ERROR: ' + e.message);
                    console.log('BODY: ' + data.substring(0, 500));
                }
            } else {
                console.log('ERROR_BODY: ' + data);
            }
        });
    });
    req.end();
} catch (e) { console.error(e); }
