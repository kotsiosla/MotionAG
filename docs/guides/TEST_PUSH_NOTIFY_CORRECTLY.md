# 🧪 Πώς να Test-άρεις το push-notify Σωστά

## ✅ Το Function Λειτουργεί Έτσι:

1. **Αν δοθεί subscription στο body:** Στέλνει σε αυτό
2. **Αν ΔΕΝ δοθεί subscription:** Παίρνει από database και στέλνει σε όλες

---

## 🧪 Test 1: Με Database Subscriptions (Προτείνεται)

### Βήμα 1: Έλεγχος αν υπάρχουν Subscriptions

1. **Supabase Dashboard** → **Table Editor**
2. Έλεγξε τα tables:
   - `stop_notification_subscriptions`
   - `push_subscriptions`
3. Αν είναι άδεια, πρέπει πρώτα να ενεργοποιήσεις notifications στο app

### Βήμα 2: Test με Άδειο Body

1. **Edge Functions** → **push-notify** → **Test**
2. **Request Body:** Άφησε **άδειο** `{}` ή **μην βάλεις τίποτα**
3. Κάνε click **"Send Request"**
4. ✅ Θα πρέπει να:
   - Βρει subscriptions από database
   - Στείλει σε όλες
   - Επιστρέψει `{ success: true, sent: X, failed: Y }`

---

## 🧪 Test 2: Με Subscription στο Body

### Βήμα 1: Πάρε Subscription από Browser

1. Άνοιξε το app στο browser
2. Άνοιξε **Developer Console** (F12)
3. Εκτέλεσε:
   ```javascript
   // Get subscription from service worker
   navigator.serviceWorker.ready.then(reg => {
     reg.pushManager.getSubscription().then(sub => {
       if (sub) {
         console.log(JSON.stringify({
           endpoint: sub.endpoint,
           keys: {
             p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
             auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth'))))
           }
         }));
       }
     });
   });
   ```

### Βήμα 2: Test με Subscription

1. **Edge Functions** → **push-notify** → **Test**
2. **Request Body:**
   ```json
   {
     "subscription": {
       "endpoint": "https://fcm.googleapis.com/...",
       "keys": {
         "p256dh": "...",
         "auth": "..."
       }
     },
     "payload": {
       "title": "Test",
       "body": "Hello!"
     }
   }
   ```
3. Κάνε click **"Send Request"**
4. ✅ Θα πρέπει να λάβεις notification!

---

## 🔍 Αν Λέει "No subscriptions found"

Αυτό σημαίνει ότι:
- Δεν υπάρχουν subscriptions στο database
- Πρέπει πρώτα να ενεργοποιήσεις notifications στο app

**Λύση:**
1. Άνοιξε το app
2. Ενεργοποίησε notifications για μια στάση
3. Μετά test ξανά

---

## ✅ Expected Response:

**Αν υπάρχουν subscriptions:**
```json
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "total": 1,
  "errors": []
}
```

**Αν ΔΕΝ υπάρχουν:**
```json
{
  "success": false,
  "message": "No subscriptions found",
  "sent": 0
}
```

---

## 🎯 Προτείνεται:

**Test με άδειο body** - αυτό είναι το πιο απλό και λειτουργεί αν έχεις subscriptions στο database.

---

**Δοκίμασε με άδειο body `{}` και πες μου τι response παίρνεις! 🚀**

