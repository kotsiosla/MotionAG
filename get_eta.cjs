const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/functions/v1/gtfs-proxy/trips?operator=all',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    const bus = json.data.find(d =>
                        (d.vehicleLabel === '71013' || d.id === '71013' || d.tripId?.includes('71013'))
                    );

                    if (bus) {
                        console.log('--- BUS FOUND ---');
                        const stopUpdate = (bus.stopTimeUpdates || []).find(stu => stu.stopId === '2811');
                        if (stopUpdate) {
                            const now = Math.floor(Date.now() / 1000);
                            const arrival = stopUpdate.arrivalTime;
                            const min = Math.round((arrival - now) / 60);
                            console.log(`ETA_STOP_2811: ${min} minutes`);
                            console.log(`ARRIVAL_TIMESTAMP: ${arrival}`);
                        } else {
                            console.log('STOP_2811_NOT_IN_TRIP');
                            // List next few stops to see where it is
                            const nextStops = (bus.stopTimeUpdates || []).slice(0, 3).map(s => s.stopId);
                            console.log('NEXT_STOPS: ' + nextStops.join(', '));
                        }
                    } else {
                        console.log('BUS_71013_GONE');
                    }
                } catch (e) {
                    console.log('ERROR: ' + e.message);
                }
            }
        });
    });
    req.end();
} catch (e) { console.error(e); }
