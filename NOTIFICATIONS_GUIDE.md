# 🔔 Οδηγός Ειδοποιήσεων - MotionBus_AI

## Πότε λειτουργούν οι ειδοποιήσεις;

### ✅ **1. Όταν είσαι ΜΕΣΑ στο app (Foreground)**
**Λειτουργεί:** ✅ ΝΑΙ

- **Ήχος:** ✅ Ναι (Web Audio API)
- **Δόνηση:** ✅ Ναι (αν το device το υποστηρίζει)
- **Φωνή:** ✅ Ναι (Web Speech API)
- **Push Notifications:** ✅ Ναι (Browser Notification API)
- **Toast Messages:** ✅ Ναι

**Πώς λειτουργεί:**
- Το `useStopArrivalNotifications` hook τρέχει συνεχώς
- Ελέγχει τις αφίξεις κάθε 3-15 δευτερόλεπτα (ανάλογα με την απόσταση)
- Όταν το λεωφορείο πλησιάζει, ενεργοποιεί όλες τις ειδοποιήσεις

---

### ⚠️ **2. Όταν το app είναι MINIMIZED (Background)**
**Λειτουργεί:** ⚠️ ΜΕΡΙΚΑ

**Τι λειτουργεί:**
- **Push Notifications:** ✅ Ναι (αν έχει ρυθμιστεί)
- **Server-side checking:** ✅ Ναι (αν έχει ρυθμιστεί cron job)

**Τι ΔΕΝ λειτουργεί:**
- ❌ Ήχος (Web Audio API δεν λειτουργεί στο background)
- ❌ Δόνηση (από το app)
- ❌ Φωνή (Web Speech API δεν λειτουργεί στο background)
- ❌ Client-side checking (το React hook δεν τρέχει)

**Πώς να λειτουργήσει:**
1. Πρέπει να έχεις ενεργοποιήσει **Push Notifications** (το κουμπί με το 🔔)
2. Πρέπει να έχει ρυθμιστεί **cron job** στο Supabase που καλεί το `check-stop-arrivals` function
3. Το server-side function ελέγχει τις αφίξεις και στέλνει push notifications

**Ρύθμιση Cron Job:**
```sql
-- Στο Supabase Dashboard > Database > Cron Jobs
-- Προσθήκη νέου cron job:
SELECT cron.schedule(
  'check-stop-arrivals',
  '*/30 * * * *', -- Κάθε 30 δευτερόλεπτα
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-stop-arrivals',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

### ❌ **3. Όταν το app είναι ΚΛΕΙΣΤΟ (Closed)**
**Λειτουργεί:** ✅ ΝΑΙ (με server-side push)

**Τι λειτουργεί:**
- **Push Notifications:** ✅ Ναι (μέσω service worker)
- **Server-side checking:** ✅ Ναι (αν έχει ρυθμιστεί cron job)

**Πώς λειτουργεί:**
1. Το **Service Worker** (`sw.js`) είναι εγγεγραμμένο
2. Το **cron job** τρέχει στο server και ελέγχει τις αφίξεις
3. Όταν βρίσκει αφίξη, στέλνει **push notification** στο device
4. Το service worker λαμβάνει το push και εμφανίζει notification
5. Κάνοντας click στο notification, ανοίγει το app

**Απαιτήσεις:**
- ✅ Push notifications ενεργοποιημένες
- ✅ Service worker εγγεγραμμένο
- ✅ Cron job ρυθμισμένο στο Supabase
- ✅ VAPID keys ρυθμισμένες

---

## 📋 Σύνοψη

| Κατάσταση | Ήχος | Δόνηση | Φωνή | Push | Toast |
|-----------|------|--------|------|------|-------|
| **Foreground (ανοιχτό)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Background (minimized)** | ❌ | ❌ | ❌ | ✅* | ❌ |
| **Closed (κλειστό)** | ❌ | ❌ | ❌ | ✅* | ❌ |

*Απαιτείται cron job configuration

---

## 🔧 Τρέχουσα Κατάσταση

### ✅ Τι λειτουργεί ΤΩΡΑ:
- ✅ **Foreground notifications:** Πλήρως λειτουργικές
- ✅ **Push subscription:** Αποθηκεύεται στο Supabase
- ✅ **Service Worker:** Εγγεγραμμένο και έτοιμο
- ✅ **Server-side function:** `check-stop-arrivals` υπάρχει

### ⚠️ Τι χρειάζεται:
- ⚠️ **Cron Job:** Πρέπει να ρυθμιστεί στο Supabase για background/closed notifications
- ⚠️ **VAPID Keys:** Πρέπει να είναι ρυθμισμένες στο Supabase environment

---

## 🚀 Πώς να ενεργοποιήσεις Background/Closed Notifications

### Βήμα 1: Ρύθμιση VAPID Keys
```bash
# Generate VAPID keys (αν δεν υπάρχουν)
# Χρησιμοποίησε το generate-vapid-keys function ή online tool
```

### Βήμα 2: Προσθήκη στο Supabase
1. Πήγαινε στο Supabase Dashboard
2. Settings > Edge Functions > Environment Variables
3. Προσθήκη:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

### Βήμα 3: Ρύθμιση Cron Job
```sql
-- Στο Supabase SQL Editor
SELECT cron.schedule(
  'check-stop-arrivals',
  '*/30 * * * *', -- Κάθε 30 δευτερόλεπτα
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-stop-arrivals',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```

---

## 📱 Testing

### Test Foreground:
1. Άνοιξε το app
2. Ενεργοποίησε ειδοποίηση για μια στάση
3. Περίμενε να πλησιάσει λεωφορείο
4. Θα ακούσεις ήχο, δόνηση, φωνή, και θα δεις toast

### Test Background:
1. Ενεργοποίησε push notifications
2. Minimize το app
3. Περίμενε push notification (αν έχει cron job)

### Test Closed:
1. Ενεργοποίησε push notifications
2. Κλείσε το app
3. Περίμενε push notification (αν έχει cron job)

---

## 🔍 Troubleshooting

### Δεν λειτουργούν foreground notifications:
- ✅ Έλεγξε αν έχεις δώσει permission για notifications
- ✅ Έλεγξε console για errors
- ✅ Έλεγξε αν το `useStopArrivalNotifications` hook τρέχει

### Δεν λειτουργούν background/closed notifications:
- ⚠️ Έλεγξε αν έχει ρυθμιστεί cron job
- ⚠️ Έλεγξε αν τα VAPID keys είναι σωστά
- ⚠️ Έλεγξε Supabase logs για errors
- ⚠️ Έλεγξε αν το push subscription είναι valid

---

**Τελευταία ενημέρωση:** 2026-01-06

