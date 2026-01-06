# 🔔 Ρύθμιση Background/Closed Notifications

## 📋 Τι χρειάζεται

Για να λειτουργήσουν οι ειδοποιήσεις όταν το app είναι minimized ή κλειστό, χρειάζεται:

1. ✅ **Service Worker** - Ήδη ρυθμισμένο
2. ✅ **Push Subscription** - Ήδη αποθηκεύεται στο Supabase
3. ✅ **Edge Function** - `check-stop-arrivals` υπάρχει
4. ⚠️ **Periodic Checking** - Χρειάζεται ρύθμιση (2 επιλογές)
5. ⚠️ **VAPID Keys** - Χρειάζονται στο Supabase

---

## 🚀 Επιλογή 1: GitHub Actions (Προτεινόμενη - 100% Δωρεάν)

### Προτεραιότητες:
- ✅ 100% δωρεάν
- ✅ Απλή ρύθμιση
- ✅ Αξιόπιστο
- ⚠️ Minimum interval: 2 λεπτά (GitHub Actions limitation)

### Βήμα 1: Ρύθμιση Secrets στο GitHub

1. Πήγαινε στο **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Προσθήκη secrets:
   - `SUPABASE_URL` = `https://mhlyndipnpwpcydjukig.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (το service role key σου)

### Βήμα 2: Ενεργοποίηση Workflow

Το workflow είναι ήδη δημιουργημένο: `.github/workflows/check-arrivals.yml`

Αυτόματα θα τρέχει **κάθε 2 λεπτά**.

### Βήμα 3: Ρύθμιση VAPID Keys

1. **Supabase Dashboard** → **Settings** → **Edge Functions** → **Environment Variables**
2. Προσθήκη:
   - `VAPID_PUBLIC_KEY` = (δημιούργησε με `generate-vapid-keys`)
   - `VAPID_PRIVATE_KEY` = (δημιούργησε με `generate-vapid-keys`)

### Βήμα 4: Έλεγχος

1. **GitHub** → **Actions** → Θα βλέπεις το workflow να τρέχει κάθε 2 λεπτά
2. **Supabase** → **Edge Functions** → **check-stop-arrivals** → **Logs**

---

## 🚀 Επιλογή 2: Supabase Cron (Αν το pg_cron είναι διαθέσιμο)

### Προτεραιότητες:
- ✅ Πιο συχνά checks (κάθε 30 δευτερόλεπτα)
- ⚠️ Χρειάζεται pg_cron extension
- ⚠️ Μπορεί να μην είναι διαθέσιμο στο free tier

### Βήμα 1: Ενεργοποίηση Extensions

1. **Supabase Dashboard** → **Database** → **Extensions**
2. Ενεργοποίησε:
   - ✅ `pg_cron`
   - ✅ `pg_net`

### Βήμα 2: Εκτέλεση Migration

1. **Supabase Dashboard** → **SQL Editor**
2. Εκτέλεσε: `supabase/migrations/20260106140000_setup_notification_cron.sql`

**Ή χειροκίνητα:**

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cron job (κάθε 30 δευτερόλεπτα)
SELECT cron.schedule(
  'check-stop-arrivals',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT net.http_post(
    url := 'https://mhlyndipnpwpcydjukig.supabase.co/functions/v1/check-stop-arrivals',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 🔑 Δημιουργία VAPID Keys

### Μέθοδος 1: Χρησιμοποίησε το generate-vapid-keys function

1. **Supabase Dashboard** → **Edge Functions** → **generate-vapid-keys**
2. Καλέσε το function
3. Αντιγράψε τα keys

### Μέθοδος 2: Online Tool

1. Πήγαινε: https://web-push-codelab.glitch.me/
2. Κάνε click "Generate Keys"
3. Αντιγράψε τα keys

### Προσθήκη στο Supabase

1. **Settings** → **Edge Functions** → **Environment Variables**
2. Προσθήκη:
   - `VAPID_PUBLIC_KEY` = (το public key)
   - `VAPID_PRIVATE_KEY` = (το private key)

---

## 🧪 Testing

### Test 1: Manual Trigger (GitHub Actions)

1. **GitHub** → **Actions** → **Check Stop Arrivals** → **Run workflow**

### Test 2: Manual Trigger (Supabase)

```sql
-- Αν χρησιμοποιείς Supabase cron
SELECT cron_check_stop_arrivals_v2();
```

### Test 3: Check Logs

1. **Supabase** → **Edge Functions** → **check-stop-arrivals** → **Logs**
2. Θα πρέπει να βλέπεις logs από τις κλήσεις

### Test 4: Test Push Notification

1. Ενεργοποίησε ειδοποίηση για μια στάση
2. Κλείσε το app
3. Περίμενε push notification (αν έχει upcoming arrival)

---

## 🔧 Troubleshooting

### GitHub Actions δεν τρέχει:
- ✅ Έλεγξε αν τα secrets είναι σωστά
- ✅ Έλεγξε **Actions** → **Permissions** → Allow workflows
- ✅ Έλεγξε τα logs στο GitHub Actions

### Supabase Cron δεν τρέχει:
- ✅ Έλεγξε αν το `pg_cron` extension είναι enabled
- ✅ Έλεγξε αν το `pg_net` extension είναι enabled
- ✅ Έλεγξε τα logs: `SELECT * FROM cron.job_run_details;`

### Δεν έρχονται push notifications:
- ✅ Έλεγξε αν τα VAPID keys είναι σωστά
- ✅ Έλεγξε αν υπάρχει push subscription στο database
- ✅ Έλεγξε τα logs του `check-stop-arrivals` function
- ✅ Έλεγξε αν το service role key είναι σωστό

---

## 📊 Monitoring

### GitHub Actions:
- **GitHub** → **Actions** → **Check Stop Arrivals**
- Θα βλέπεις execution history

### Supabase Cron:
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Subscriptions:
```sql
SELECT id, endpoint, 
       jsonb_array_length(stop_notifications::jsonb) as notification_count,
       updated_at
FROM stop_notification_subscriptions;
```

### Function Logs:
- **Supabase** → **Edge Functions** → **check-stop-arrivals** → **Logs**

---

## 💰 Κόστος

**Όλα δωρεάν!** 🎉

### GitHub Actions:
- ✅ 2,000 minutes/month (δωρεάν)
- ✅ ~2,880 minutes/month για 2-minute intervals = **Εντός ορίου!**

### Supabase:
- ✅ Free Tier: 500MB database, 2GB bandwidth
- ✅ Edge Functions: 500K invocations/month
- ✅ ~86,400 calls/month για 30-second intervals = **Εντός ορίου!**

---

## ✅ Checklist

- [ ] GitHub secrets configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] VAPID keys configured στο Supabase
- [ ] GitHub Actions workflow enabled
- [ ] Test push notification sent
- [ ] Background notifications working
- [ ] Closed app notifications working

---

## 📝 Σύνοψη

| Μέθοδος | Interval | Δωρεάν | Αξιοπιστία |
|---------|----------|--------|------------|
| **GitHub Actions** | 2 λεπτά | ✅ Ναι | ⭐⭐⭐⭐⭐ |
| **Supabase Cron** | 30 δευτερόλεπτα | ✅ Ναι* | ⭐⭐⭐⭐ |

*Αν το pg_cron είναι διαθέσιμο

**Συνιστάται:** GitHub Actions (πιο αξιόπιστο και εύκολο)

---

**Τελευταία ενημέρωση:** 2026-01-06
