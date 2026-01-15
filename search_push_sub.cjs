const fs = require('fs');
const https = require('https');

try {
    const key = fs.readFileSync('key.txt', 'utf8').trim();
    const search = 'dK08x8t';
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: `/rest/v1/push_subscriptions?select=*&endpoint=like.*${search}*`,
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + key,
            'apikey': key
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('Search Results in push_subscriptions for:', search);
            console.log(data);
        });
    });
    req.end();
} catch (e) {
    console.error(e);
}
