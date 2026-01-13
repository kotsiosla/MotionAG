const fs = require('fs');

try {
    const content = fs.readFileSync('temp_bundle_v2.js', 'utf8');
    // Using a substring from the button text I added
    if (content.includes('Ολική Διαγραφή')) {
        console.log("✅ FOUND: 'Hard Reset' button is in the bundle!");
    } else {
        console.log("❌ NOT FOUND: The string is missing.");
    }
} catch (e) {
    console.error("Error:", e.message);
}
