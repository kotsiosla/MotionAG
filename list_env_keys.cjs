const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        // Strip BOM
        content = content.replace(/^\uFEFF/, '');

        // Split by any newline
        const lines = content.split(/\r?\n/);
        console.log(`--- ENV KEYS (Lines: ${lines.length}) ---`);

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const idx = trimmed.indexOf('=');
            if (idx !== -1) {
                const key = trimmed.substring(0, idx).trim();
                const val = trimmed.substring(idx + 1).trim();
                console.log(`${key}: ${val.slice(0, 5)}...`);
            } else {
                console.log(`[Non-Key Line]: ${trimmed.slice(0, 10)}...`);
            }
        });
    } else {
        console.log('.env file not found');
    }
} catch (e) {
    console.error(e);
}
