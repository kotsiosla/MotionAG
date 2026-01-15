const https = require('https');

const url = 'https://jftthfniwfarxyisszjh.supabase.co/functions/v1/gtfs-proxy/arrivals?stopId=2793';
const options = {
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE'
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json.data, null, 2));
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            console.log('Raw output:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
