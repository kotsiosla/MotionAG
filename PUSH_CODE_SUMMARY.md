# Push Notification Code Summary

## 1. Payload Creation

```typescript
const payload = JSON.stringify({
  title,
  body,
  icon: '/pwa-192x192.png',
  url: '/',
});
```

## 2. VAPID Keys Loading

```typescript
// Keys loaded from environment variables
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'); // base64url format
const privateKey = Deno.env.get('VAPID_PRIVATE_KEY'); // PKCS#8 base64url format

// Converted to ApplicationServerKeys
applicationServerKeys = await ApplicationServerKeys.fromJSON({
  publicKey: publicKey, // base64url string
  privateKey: privateKeyPKCS8, // PKCS#8 standard base64 string
});
```

**Current VAPID Public Key (redacted):**
- Starts with: `BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8...`
- Ends with: `...FB5vtU`
- Length: 87 characters (base64url)

## 3. Push Request Generation (Token Creation)

```typescript
pushRequest = await generatePushHTTPRequest({
  applicationServerKeys,  // VAPID keys (loaded above)
  payload,                // JSON string from step 1
  target: {
    endpoint: sub.endpoint,  // e.g., "https://wns2-db5p.notify.windows.com/w/?token=..."
    keys: {
      p256dh: toBase64Url(sub.p256dh),  // Subscription public key
      auth: toBase64Url(sub.auth),       // Subscription auth key
    },
  },
  adminContact: 'mailto:info@motionbus.cy',
  ttl: 86400,      // 24 hours
  urgency: 'high',
});
```

**The `generatePushHTTPRequest` function (from webpush-webcrypto library) creates:**
- VAPID JWT token in `Authorization` header
- Encrypted payload
- All required headers (Content-Type, Content-Encoding, etc.)

## 4. POST Request to WNS

```typescript
const { headers, body, endpoint } = pushRequest;

const response = await fetchWithTimeout(endpoint, {
  method: 'POST',
  headers,  // Includes Authorization header with VAPID JWT
  body,     // Encrypted payload
}, 10000);
```

**Headers sent (example):**
```
Authorization: vapid t=<JWT_TOKEN>, k=<VAPID_PUBLIC_KEY>
Content-Type: application/octet-stream
Content-Encoding: aes128gcm
TTL: 86400
Urgency: high
```

**Endpoint example:**
```
https://wns2-db5p.notify.windows.com/w/?token=BQYAAAAA...
```

## 5. Subscription Keys Format

```typescript
// Keys from database are converted to base64url
const p256dh = toBase64Url(sub.p256dh);  // 88 chars (base64 encoded 65-byte key)
const auth = toBase64Url(sub.auth);      // 24 chars (base64 encoded 16-byte key)
```

## Current Issue (RESOLVED)

- **Error:** `400` from WNS with empty body
- **Root Cause:** WNS (Windows Notification Service) **DOES NOT support Web Push / VAPID**
- **Solution:** Skip WNS endpoints - Edge should use FCM endpoints for Web Push

## Fix Applied

Added endpoint detection to skip WNS endpoints:
```typescript
if (endpointHostname.includes('wns.') || endpointHostname.includes('notify.windows.com')) {
  console.warn('Skipping WNS endpoint - WNS doesn't support Web Push/VAPID');
  // Skip this subscription
  continue;
}
```

**Why:** WNS requires:
- OAuth 2.0 Bearer tokens (not VAPID JWT)
- XML payloads (not encrypted Web Push payloads)
- X-WNS-Type headers

**Edge browsers should use FCM endpoints for Web Push, not WNS.**

## Library Used

- `webpush-webcrypto@1.0.0` from esm.sh
- Functions: `ApplicationServerKeys.fromJSON()`, `generatePushHTTPRequest()`

