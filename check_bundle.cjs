const fs = require('fs');

try {
    const content = fs.readFileSync('temp_bundle.js', 'utf8');
    if (content.includes('Force Reset')) {
        console.log("✅ FOUND: 'Force Reset' is in the bundle!");
    } else {
        console.log("❌ NOT FOUND: The string is missing.");
    }
} catch (e) {
    console.error("Error:", e.message);
}
