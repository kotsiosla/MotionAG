const fs = require('fs');
try {
    const content = fs.readFileSync('.env', 'utf8');
    const match = content.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    if (match) {
        fs.writeFileSync('key.txt', match[1].trim());
        console.log('KEY_SAVED');
    } else {
        console.log('KEY_NOT_FOUND');
    }
} catch (e) {
    console.error(e);
}
