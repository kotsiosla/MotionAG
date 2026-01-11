const fs = require('fs');
try {
    const content = fs.readFileSync('.env', 'utf8');
    // Remove BOM if present (U+FEFF)
    const cleanContent = content.replace(/^\uFEFF/, '');
    fs.writeFileSync('.env', cleanContent, 'utf8');
    console.log('ENV_FIXED');
} catch (e) {
    console.error(e);
}
