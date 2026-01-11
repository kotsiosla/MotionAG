const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/gtfs-proxy/arrivals?stopId=2877',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'Accept': 'application/json'
        }
    };

    console.log('Fetching arrivals for Stop 2877...');

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

                    if (json.sources) {
                        console.log('SOURCES: ' + JSON.stringify(json.sources));
                    }

                    if (arrivals.length > 0) {
                        console.log('--- NEXT 3 ARRIVALS ---');
                        arrivals.slice(0, 3).forEach(a => {
                            const eta = Math.round((a.bestArrivalTime - (Date.now() / 1000)) / 60);
                            console.log(`Route ${a.routeId} (${a.vehicleId || '?'}) - ${eta} min - Source: ${a.source} - Conf: ${a.confidence || '?'}`);
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
