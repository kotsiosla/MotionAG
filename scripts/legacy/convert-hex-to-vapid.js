// Convert hex VAPID keys to base64url/base64 format
// Run this in Node.js or browser console

const publicKeyHex = '2012bebafaf0dbdf2c1ade1656c2a2ce13dbd81b61468d2bcf3f5b55a85accf6';
const privateKeyHex = 'd6fdf821fbab33d6a367775feca9cb141b2e199602f5b3d5286f7cb42c13c5b0';

// Convert hex to bytes
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Convert bytes to base64url
function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert bytes to standard base64
function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// VAPID public key: 65 bytes = 0x04 (uncompressed) + 32 bytes X + 32 bytes Y
// But hex keys are usually just the raw 64 bytes (X + Y), so we need to add 0x04 prefix
const publicKeyBytes = hexToBytes(publicKeyHex);
if (publicKeyBytes.length === 64) {
  // Add 0x04 prefix for uncompressed format
  const fullPublicKey = new Uint8Array(65);
  fullPublicKey[0] = 0x04;
  fullPublicKey.set(publicKeyBytes, 1);
  const publicKeyBase64Url = bytesToBase64Url(fullPublicKey);
  console.log('VAPID_PUBLIC_KEY (base64url):', publicKeyBase64Url);
} else {
  console.error('Public key should be 64 hex chars (32 bytes X + 32 bytes Y)');
}

// VAPID private key: 32 bytes scalar
const privateKeyBytes = hexToBytes(privateKeyHex);
if (privateKeyBytes.length === 32) {
  // For private key, we need PKCS#8 format, but for now just convert to base64url
  // The library might handle raw keys, but typically needs PKCS#8
  const privateKeyBase64Url = bytesToBase64Url(privateKeyBytes);
  console.log('VAPID_PRIVATE_KEY (base64url, raw):', privateKeyBase64Url);
  console.log('Note: Private key may need PKCS#8 format for webpush-webcrypto');
} else {
  console.error('Private key should be 64 hex chars (32 bytes)');
}

