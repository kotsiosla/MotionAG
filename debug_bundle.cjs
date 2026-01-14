const https = require('https');
const URL = 'https://kotsiosla.github.io/MotionAG/index.html';

https.get(URL + '?t=' + Date.now(), (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const matches = data.match(/src="\/MotionAG\/assets\/index-[a-zA-Z0-9]+\.js"/g);
        console.log('Matches:', matches);

        const scriptMatch = data.match(/src="(\/MotionAG\/assets\/index-[a-zA-Z0-9]+\.js)"/);
        if (scriptMatch) {
            const bundleUrl = 'https://kotsiosla.github.io' + scriptMatch[1];
            console.log('Fetching bundle:', bundleUrl);
            https.get(bundleUrl, (res2) => {
                let bundle = '';
                res2.on('data', chunk => bundle += chunk);
                res2.on('end', () => {
                    console.log('v1.5.16.5 found:', bundle.includes('v1.5.16.5'));
                    console.log('v1.5.16.4 found:', bundle.includes('v1.5.16.4'));
                    console.log('v1.5.16.2 found:', bundle.includes('v1.5.16.2'));
                });
            });
        } else {
            console.log('No script found');
        }
    });
});
