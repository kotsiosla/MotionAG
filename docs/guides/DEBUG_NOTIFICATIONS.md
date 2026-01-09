# 🔍 Debugging Push Notifications

## Πρόβλημα: Δεν ενεργοποιούνται οι ειδοποιήσεις

### Βήματα Debugging:

#### 1. **Άνοιξε Browser Console (F12)**
   - Πάτα F12 στο browser
   - Πήγαινε στο tab "Console"
   - Κάνε enable notification για μια στάση
   - Δες τα logs που ξεκινάνε με `[StopNotificationModal]`

#### 2. **Ελέγξε τα Logs:**

**Αν βλέπεις:**
```
[StopNotificationModal] Base path: /MotionBus_AI/
[StopNotificationModal] Checking for existing service worker registrations...
[StopNotificationModal] Existing service worker registrations: 0
[StopNotificationModal] Will try service worker paths: [...]
[StopNotificationModal] Trying to register: /MotionBus_AI/sw.js
```

**Αν βλέπεις error:**
- `❌ Service worker registration failed` → Το service worker δεν βρέθηκε
- `❌ Push subscription failed` → Το VAPID key δεν είναι σωστό ή το browser δεν υποστηρίζει

#### 3. **Ελέγξε Service Worker:**

**Στο Console, τρέξε:**
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => {
    console.log('Scope:', reg.scope);
    console.log('Active:', reg.active?.state);
  });
});
```

**Αν δεν υπάρχει service worker:**
- Το service worker δεν έχει register-αρεί
- Ελέγξε αν το `/MotionBus_AI/sw.js` υπάρχει (άνοιξε στο browser)

#### 4. **Ελέγξε Push Subscription:**

**Στο Console, τρέξε:**
```javascript
navigator.serviceWorker.ready.then(reg => {
  return reg.pushManager.getSubscription();
}).then(sub => {
  if (sub) {
    console.log('✅ Push subscription exists');
    console.log('Endpoint:', sub.endpoint);
  } else {
    console.log('❌ No push subscription');
  }
});
```

#### 5. **Ελέγξε VAPID Key:**

**Στο Console, τρέξε:**
```javascript
const VAPID_KEY = 'BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg';
console.log('VAPID Key length:', VAPID_KEY.length);
console.log('VAPID Key:', VAPID_KEY);
```

**Πρέπει να είναι:**
- Length: 88 characters
- Format: Base64 URL-safe

#### 6. **Ελέγξε HTTPS:**

**Push notifications χρειάζονται HTTPS!**
- ✅ `https://kotsiosla.github.io/MotionBus_AI/` → OK
- ❌ `http://localhost:8080` → Δεν δουλεύει (εκτός αν είναι localhost)

#### 7. **Ελέγξε Browser Support:**

**Supported:**
- ✅ Chrome (Android & Desktop)
- ✅ Firefox (Android & Desktop)
- ✅ Edge (Desktop)
- ❌ Safari iOS (μόνο client-side notifications)
- ❌ Safari macOS (μόνο client-side notifications)

### Common Errors:

#### Error: "Service worker registration failed"
**Λύση:**
1. Ελέγξε αν το `/MotionBus_AI/sw.js` υπάρχει
2. Άνοιξε: `https://kotsiosla.github.io/MotionBus_AI/sw.js`
3. Αν βγάζει 404, το service worker δεν έχει build-αρεί σωστά

#### Error: "InvalidApplicationServerKey"
**Λύση:**
1. Ελέγξε το VAPID key στο `StopNotificationModal.tsx` (line 21)
2. Ελέγξε το VAPID key στο Supabase Edge Functions Secrets
3. Πρέπει να είναι **ίδια**!

#### Error: "NotSupportedError"
**Λύση:**
- Το browser δεν υποστηρίζει push notifications
- Χρησιμοποίησε Chrome, Firefox ή Edge

#### Error: "Permission denied"
**Λύση:**
1. Πάτα "Allow" όταν σου ζητήσει permission
2. Αν το έχεις reject-άρει, πήγαινε στις browser settings
3. Allow notifications για το website

### Testing Steps:

1. **Clear Service Workers:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   ```

2. **Clear Cache:**
   - Browser Settings → Clear browsing data → Cached images and files

3. **Reload Page:**
   - Hard reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

4. **Try Again:**
   - Enable notification για μια στάση
   - Δες τα logs στο console

### Αν ακόμα δεν δουλεύει:

**Στείλε μου:**
1. Screenshot από το browser console (F12)
2. Browser version (Chrome 120, Firefox 121, etc.)
3. OS (Android 13, iOS 17, Windows 11, etc.)
4. Exact error messages από τα logs

---

*Last updated: 2026-01-07*

