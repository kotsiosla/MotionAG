const https = require('https');
const fs = require('fs');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const projectUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
    const stopId = '2877';
    const url = `${projectUrl}/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`;

    const options = {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key
        }
    };

    const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.data) {
                    const now = Date.now() / 1000;
                    const upcoming = json.data.map(arr => {
                        const mins = Math.round((arr.bestArrivalTime - now) / 60);
                        return { route: arr.routeShortName, mins, time: arr.bestArrivalTime };
                    }).filter(a => a.mins < 60);

                    console.log(`Found ${upcoming.length} arrivals within 60 mins.`);
                    upcoming.forEach(a => console.log(`Bus ${a.route}: ${a.mins} mins`));
                }
            } catch (e) { console.log('Error parsing'); }
        });
    });

    req.end();
} catch (e) { console.error(e); }
