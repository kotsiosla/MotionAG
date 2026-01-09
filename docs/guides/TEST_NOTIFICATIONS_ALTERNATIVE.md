# 🧪 Alternative Test: StopNotificationModal

## ⚠️ Το Πρόβλημα:

Το panel "Κοντινότερη Στάση" δεν έχει λεωφορεία, οπότε δεν μπορούμε να δοκιμάσουμε από εκεί.

---

## ✅ Εναλλακτικοί Τρόποι:

### Επιλογή 1: Από το Map (Stop Marker)

1. **Πήγαινε στο Map**
2. **Κάνε click σε μια στάση** (stop marker) στο map
3. **Ανοίγει το StopDetailPanel**
4. **Κάνε click στο 🔔** (Bell icon)
5. **Ανοίγει το StopNotificationModal**
6. **Κάνε click "Ενεργοποίηση"**

### Επιλογή 2: Από το RoutePlanner

1. **Άνοιξε το RoutePlanner**
2. **Σχεδίασε μια διαδρομή** (π.χ. Limassol - Paphos)
3. **Κάνε click σε μια στάση** από τα results
4. **Ανοίγει το StopDetailPanel**
5. **Κάνε click στο 🔔**
6. **Κάνε click "Ενεργοποίηση"**

---

## 🔍 Τι να Ελέγξεις:

### 1. Console Logs

Μετά την ενεργοποίηση, έλεγξε το Console για:

- `[StopNotificationModal] Supabase URL:`
- `[StopNotificationModal] Checking for existing subscription...`
- `[StopNotificationModal] Attempting to save subscription:`
- `[StopNotificationModal] ✅ Update successful:` ή `Insert successful:`
- `[StopNotificationModal] Update error:` ή `Insert error:` (αν υπάρχει error)

### 2. Table Editor

1. **Supabase Dashboard** → **Table Editor**
2. **Άνοιξε** `stop_notification_subscriptions`
3. **Κάνε Refresh**
4. **Έλεγξε** αν υπάρχουν rows

---

## 📋 Αν Δεν Υπάρχουν Stops στο Map:

### Επιλογή 3: Manual Test με SQL

Μπορούμε να δοκιμάσουμε manual insert για να δούμε αν τα RLS policies λειτουργούν:

```sql
-- Test insert (αντιγράψε το endpoint από το Console)
INSERT INTO public.stop_notification_subscriptions (
  endpoint,
  p256dh,
  auth,
  stop_notifications
) VALUES (
  'https://wns2-db5p.notify.windows.com/w/?token=TEST',
  'TEST_P256DH_KEY',
  'TEST_AUTH_KEY',
  '[{"stopId": "2877", "stopName": "Test Stop", "enabled": true, "push": true, "beforeMinutes": 5}]'::jsonb
);
```

Αν αυτό λειτουργεί, το πρόβλημα είναι στο frontend. Αν δεν λειτουργεί, το πρόβλημα είναι στα RLS policies.

---

**Δοκίμασε από το Map ή RoutePlanner και στείλε μου τα logs! 🧪**

