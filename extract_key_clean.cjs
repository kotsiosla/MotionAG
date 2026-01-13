const fs = require('fs');

const content = fs.readFileSync('bundle.js', 'utf8');
// Matches standard JWT format: header.payload.signature
// header starts with eyJ
const regex = /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g;
const matches = content.match(regex);

if (matches) {
    const validKeys = matches.filter(m => m.length > 50); // specific length filter
    fs.writeFileSync('found_keys.txt', validKeys.join('\n'));
    console.log(`Wrote ${validKeys.length} keys to found_keys.txt`);
} else {
    fs.writeFileSync('found_keys.txt', 'NO_KEYS_FOUND');
}
