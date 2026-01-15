const https = require('https');
const url = "https://kotsiosla.github.io/MotionAG/index.html";
const req = https.get(url, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log("STATUS:", res.statusCode);
        const match = data.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
        console.log("Found Script:", match ? match[0] : "NONE");
    });
});
req.end();
