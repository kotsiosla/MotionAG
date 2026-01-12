const crypto = require('crypto').webcrypto || globalThis.crypto;

// Base64url encode/decode
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

const EXPECTED_PUB = "BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw";
const PRIV = "ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk";

(async () => {
    try {
        const d = base64UrlDecode(PRIV);
        // Import Private Key to get Public Key?
        // WebCrypto: import private, then derive public? No, usually import full pair.
        // But we only have d.
        // We can import as JWK with d, then export as JWK/raw without d?

        // P-256 curve points are specific.
        // Easier: Use node:crypto
        const nodeCrypto = require('crypto');
        const curve = nodeCrypto.createECDH('prime256v1');
        curve.setPrivateKey(d);
        const pub = curve.getPublicKey();
        // pub is Buffer (0x04 + x + y)
        const pubB64 = base64UrlEncode(pub);

        console.log("Expected Pub:", EXPECTED_PUB);
        console.log("Derived Pub: ", pubB64);
        console.log("Match:", EXPECTED_PUB === pubB64);

    } catch (e) {
        console.error(e);
    }
})();
