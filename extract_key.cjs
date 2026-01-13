const fs = require('fs');

const content = fs.readFileSync('bundle.js', 'utf8');
const regex = /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g;
const matches = content.match(regex);

if (matches) {
    console.log("Found Potentials:", matches.length);
    matches.forEach(m => {
        // Filter out the service role key if known, or just print all
        if (m.length > 50 && m.length < 300) { // Keys are roughly this length
            console.log(m);
        }
    });
} else {
    console.log("No keys found.");
}
