const fs = require('fs');
const content = fs.readFileSync('new_keys.json', 'utf16le').replace(/^\uFEFF/, '');
const keys = JSON.parse(content);
console.log('---START_KEYS---');
console.log(keys.publicKey);
console.log(keys.privateKey);
console.log('---END_KEYS---');
