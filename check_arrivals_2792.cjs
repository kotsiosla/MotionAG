const https = require('https');
const stopId = "2792";
const url = `https://jftthfniwfarxyisszjh.supabase.co/functions/v1/gtfs-proxy/arrivals?stopId=${stopId}`;
const key = require('fs').readFileSync('key.txt', 'utf8').trim();

const options = {
    headers: { 'Authorization': `Bearer ${key}` }
};

https.get(url, options, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log(`Arrivals for ${stopId}:`);
            parsed.data.forEach(a => {
                console.log(`- Bus ${a.routeShortName} (${a.vehicleId || 'N/A'}) in ${Math.round((a.bestArrivalTime - Date.now() / 1000) / 60)} mins`);
            });
        } catch (e) { console.log(data); }
    });
}).on('error', e => console.log(e.message));
