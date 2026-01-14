const https = require('https');
// The hash DQPcDZIS comes from the build output in Step 4901
const url = 'https://kotsiosla.github.io/MotionAG/assets/index-DqB9jMdi.js';
const req = https.request(url, { method: 'HEAD' }, res => {
    console.log("STATUS:", res.statusCode);
});
req.on('error', e => console.log('ERROR:', e.message));
req.end();
