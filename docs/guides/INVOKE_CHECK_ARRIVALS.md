# 🚀 Test Push Notifications - Invoke check-stop-arrivals

## ✅ Status: Subscription Saved!

Το `stop_notification_subscriptions` table έχει subscription με:
- ✅ `endpoint`: Windows Push Notification Service
- ✅ `p256dh` και `auth`: Push keys
- ✅ `stop_notifications`: Array με enabled notifications

## 🧪 Test Steps:

### Βήμα 1: Invoke το `check-stop-arrivals` function

1. **Πήγαινε στο Supabase Dashboard:**
   - https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/functions

2. **Βρες το `check-stop-arrivals` function**

3. **Κάνε Invoke:**
   - Κάνε click στο function
   - Κάνε click **"Invoke Function"** button
   - Δες τα **Logs** tab

### Βήμα 2: Έλεγξε τα Logs

Θα πρέπει να δεις:
```
VAPID keys loaded successfully
Fetching subscriptions from stop_notification_subscriptions...
Found 1 subscriptions (before filtering)
Subscription 1: { id: '...', endpoint: '...', stop_notifications_count: 1 }
Checking 1 subscriptions for stop arrivals
Got X trip updates from gtfs-proxy
```

### Βήμα 3: Αν υπάρχει arrival που ταιριάζει

Θα δεις:
```
Push sent for stop 2877, route XXX, X min
Push succeeded with status 200
```

### Βήμα 4: Έλεγξε το Device

- Αν το app είναι **open** → θα δεις notification στο browser
- Αν το app είναι **minimized** → θα δεις notification στο OS
- Αν το app είναι **closed** → θα δεις notification στο OS (αν το service worker είναι registered)

## 🔍 Αν δεν δουλεύει:

1. **Έλεγξε τα VAPID keys:**
   - Edge Functions → Secrets
   - Πρέπει να υπάρχουν: `VAPID_PUBLIC_KEY` και `VAPID_PRIVATE_KEY`

2. **Έλεγξε τα Logs για errors:**
   - `VAPID keys not configured` → Add keys to Secrets
   - `No subscriptions found` → Check table again
   - `Push failed with status 410` → Subscription expired, delete and re-subscribe
   - `Push failed with status 404` → Invalid endpoint, delete subscription

3. **Έλεγξε το gtfs-proxy:**
   - Αν `Got 0 trip updates`, το GTFS API δεν επιστρέφει data
   - Test: `https://jftthfniwfarxyisszjh.supabase.co/functions/v1/gtfs-proxy/trips?operator=all`

## 📱 Test Manual Push (Optional)

Αν θέλεις να στείλεις test notification χωρίς να περιμένεις arrival:

1. **Invoke το `push-notify` function** (αν υπάρχει)
2. Ή χρησιμοποίησε το `test-push` function

## ✅ Success!

Αν βλέπεις `Push succeeded with status 200` → **Οι push notifications δουλεύουν!** 🎉

