const crypto = require('crypto').webcrypto || globalThis.crypto;

// Helper: Base64URL
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function base64UrlEncode(data) {
    let result = ""; let i = 0; const len = data.length;
    for (; i < len; i += 3) {
        const b1 = data[i]; const b2 = i + 1 < len ? data[i + 1] : 0; const b3 = i + 2 < len ? data[i + 2] : 0;
        const trip = (b1 << 16) | (b2 << 8) | b3;
        result += B64_CHARS[(trip >> 18) & 0x3F] + B64_CHARS[(trip >> 12) & 0x3F] + (i + 1 < len ? B64_CHARS[(trip >> 6) & 0x3F] : "") + (i + 2 < len ? B64_CHARS[trip & 0x3F] : "");
    }
    return result;
}
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4 !== 0) str += '=';
    return Buffer.from(str, 'base64');
}

const PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";

// Server Fallback values
const SERVER_X = "blV8NeTK0Vp5xMv6hZIKchFkdWDWn1_A9pGyYDWuw9I";
const SERVER_Y = "6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";

const bytes = base64UrlDecode(PUB);
console.log("Total bytes:", bytes.length); // Should be 65
console.log("Leading byte:", bytes[0]); // Should be 4

const xBytes = bytes.slice(1, 33);
const yBytes = bytes.slice(33, 65);

const calcX = base64UrlEncode(xBytes);
const calcY = base64UrlEncode(yBytes);

console.log("Calculated X:", calcX);
console.log("Server X:    ", SERVER_X);
console.log("Match X:     ", calcX === SERVER_X);

console.log("Calculated Y:", calcY);
console.log("Server Y:    ", SERVER_Y);
console.log("Match Y:     ", calcY === SERVER_Y);
