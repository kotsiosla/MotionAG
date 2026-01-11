const fs = require('fs');
try {
    const content = fs.readFileSync('.env', 'utf8');
    const match = content.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    if (match) {
        const key = match[1].trim();
        console.log('---START---');
        for (let i = 0; i < key.length; i += 50) {
            console.log(key.substring(i, i + 50));
        }
        console.log('---END---');
    } else {
        console.log('KEY_NOT_FOUND');
    }
} catch (e) {
    console.error(e);
}
