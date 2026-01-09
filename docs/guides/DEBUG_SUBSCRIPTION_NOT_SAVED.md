# 🔍 Debug: Subscription Δεν Αποθηκεύεται

## ❌ Το Πρόβλημα:

Το subscription δεν αποθηκεύεται στο database - το function λέει "No subscriptions found".

---

## 🔍 Έλεγχος:

### Βήμα 1: Έλεγχος Browser Console

1. **Developer Console** (F12) → **Console** tab
2. Ενεργοποίησε notifications
3. Έλεγξε αν βλέπεις:
   - ✅ "Subscription created successfully"
   - ✅ "Synced X notifications to server"
   - ❌ Errors (π.χ. "Failed to add stop", "Insert error")

### Βήμα 2: Έλεγχος Network Tab

1. **Developer Console** → **Network** tab
2. Ενεργοποίησε notifications
3. Έλεγξε αν βλέπεις requests στο Supabase:
   - POST to `stop_notification_subscriptions`
   - Αν υπάρχει, έλεγξε το response (200 OK ή error?)

### Βήμα 3: Έλεγχος Database

1. **Supabase Dashboard** → **Table Editor** → `stop_notification_subscriptions`
2. Κάνε click στο table
3. Έλεγξε αν υπάρχουν rows
4. Αν είναι άδειο, το subscription δεν αποθηκεύτηκε

---

## 🔧 Αν Δεν Αποθηκεύεται:

### Επιλογή 1: Έλεγχος Errors

Αν βλέπεις errors στο Console:
- **RLS Policy Error:** Μπορεί να χρειάζεται να update τα policies
- **Network Error:** Το request δεν φτάνει στο Supabase
- **Format Error:** Το subscription δεν είναι στο σωστό format

### Επιλογή 2: Manual Check

Στο **Console**, εκτέλεσε:
```javascript
// Check if subscription exists
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    if (sub) {
      console.log('Subscription:', sub.endpoint);
      // Try to save manually
      const keys = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      console.log('Keys:', {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(keys))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth)))
      });
    }
  });
});
```

---

## 📝 Πιθανά Προβλήματα:

1. **RLS Policies:** Μπορεί να μην επιτρέπουν insert
2. **Network Error:** Το request δεν φτάνει
3. **Format Error:** Το subscription format δεν είναι σωστό

---

**Έλεγξε το Console και πες μου τι errors βλέπεις! 🔍**

