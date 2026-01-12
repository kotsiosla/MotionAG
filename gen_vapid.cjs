const crypto = require('crypto');

// Generate P-256 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
});

// Export Private Key (Raw 32 bytes)
const privateKeyBuffer = privateKey.export({ format: 'sec1', type: 'sec1' });
// SEC1 for private key is a sequence. We just want the raw 'd' value.
// Actually, crypto.createECDH is easier for raw keys.
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const pubBuffer = ecdh.getPublicKey(); // Uncompressed 65 bytes
const privBuffer = ecdh.getPrivateKey(); // 32 bytes

const pubBase64 = pubBuffer.toString('base64url');
const privBase64 = privBuffer.toString('base64url');

console.log('---VAPID_START---');
console.log('PUBLIC_KEY:', pubBase64);
console.log('PRIVATE_KEY:', privBase64);
console.log('---VAPID_END---');

// Self-test
try {
    const testEc = crypto.createECDH('prime256v1');
    testEc.setPublicKey(pubBuffer);
    console.log('Validation: Public key is a valid P-256 point.');
    console.log('Public length:', pubBuffer.length);
    console.log('Private length:', privBuffer.length);
} catch (e) {
    console.log('Validation FAILED:', e.message);
}
