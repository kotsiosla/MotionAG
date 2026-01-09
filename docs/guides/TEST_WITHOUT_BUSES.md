# 🧪 Test Χωρίς Λεωφορεία

## ✅ Επιλογή 1: Manual SQL Test

### Βήμα 1: Πάρε το Endpoint από το Console

1. **Developer Console** (F12) → **Console** tab
2. **Ενεργοποίησε** "Push Ειδοποιήσεις" (ακόμα και χωρίς λεωφορεία)
3. **Ψάξε** για: `[NearbyStopsPanel] Attempting upsert with:`
4. **Αντιγράψε** το `endpoint` (το πλήρες URL)

### Βήμα 2: Manual SQL Insert

1. **Supabase Dashboard** → **SQL Editor**
2. **Αντικατέστησε** το `YOUR_ENDPOINT_HERE` με το endpoint από το Console
3. **Τρέξε** αυτό:

```sql
-- Test insert με το δικό σου endpoint
INSERT INTO public.stop_notification_subscriptions (
  endpoint,
  p256dh,
  auth,
  stop_notifications
) VALUES (
  'YOUR_ENDPOINT_HERE',  -- Αντικατέστησε με το endpoint από το Console
  'TEST_P256DH_KEY_BASE64',
  'TEST_AUTH_KEY_BASE64',
  '[{"stopId": "2877", "stopName": "Test Stop", "enabled": true, "push": true, "beforeMinutes": 5}]'::jsonb
)
ON CONFLICT (endpoint) DO UPDATE SET
  stop_notifications = EXCLUDED.stop_notifications,
  updated_at = now()
RETURNING *;
```

### Βήμα 3: Έλεγξε

1. **Table Editor** → `stop_notification_subscriptions`
2. **Refresh**
3. **Έλεγξε** αν υπάρχει row

---

## ✅ Επιλογή 2: Test με StopNotificationModal

### Από το Map:

1. **Πήγαινε στο Map**
2. **Κάνε click σε μια στάση** (stop marker) - δεν χρειάζεται να έχει λεωφορεία
3. **Κάνε click στο 🔔**
4. **Κάνε click "Ενεργοποίηση"**

### Από το RoutePlanner:

1. **Άνοιξε το RoutePlanner**
2. **Σχεδίασε μια διαδρομή**
3. **Κάνε click σε μια στάση**
4. **Κάνε click στο 🔔**
5. **Κάνε click "Ενεργοποίηση"**

---

## ✅ Επιλογή 3: Test το check-stop-arrivals Function

### Καλέσε το Function:

1. **Supabase Dashboard** → **Edge Functions** → **check-stop-arrivals**
2. **Invoke** button
3. **Έλεγξε τα Logs**

Θα πρέπει να βλέπεις:
- `Found X subscriptions (before filtering)`
- `Subscription 1: { ... }`
- `Total subscriptions in table (including null): X`

---

## 📋 Next Steps:

1. **Δοκίμασε** το Manual SQL insert
2. **Ή** δοκίμασε από το StopNotificationModal
3. **Ή** καλέσε το check-stop-arrivals function
4. **Στείλε μου** τα αποτελέσματα

---

**Δοκίμασε ένα από αυτά και πες μου τι βλέπεις! 🧪**

