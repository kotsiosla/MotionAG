# Setup Cron Job για Background Notifications

## ⚠️ Σημαντικό

Το `pg_cron` extension **μπορεί να μην είναι διαθέσιμο** στο free tier του Supabase. Το script `setup_background_notifications.sql` είναι **safe** και **δεν αποτυγχάνει** αν το `pg_cron` δεν είναι διαθέσιμο.

---

## Επιλογή 1: Supabase Cron (Safe Script)

### Βήμα 1: Εκτέλεση SQL Script

1. **Supabase Dashboard** → **Database** → **SQL Editor**
2. Άνοιξε το `setup_background_notifications.sql`
3. **Αντέγραψε το SERVICE_ROLE_KEY:**
   - Πήγαινε: **Settings** → **API**
   - Αντιγράψε το **service_role key** (secret)
4. **Αντικατέστησε** `YOUR_SERVICE_ROLE_KEY_HERE` με το πραγματικό key (γραμμή 29)
5. **Τρέξε** το script

### Τι κάνει το script:

- ✅ Ενεργοποιεί `pg_net` (συνήθως διαθέσιμο)
- ✅ Προσπαθεί να ενεργοποιήσει `pg_cron` (αποτυγχάνει gracefully αν δεν είναι διαθέσιμο)
- ✅ Αν το `pg_cron` είναι διαθέσιμο, προγραμματίζει job κάθε 1 λεπτό
- ✅ Αν δεν είναι διαθέσιμο, ενημερώνει ότι χρειάζεται external scheduler
- ✅ Καταγράφει την κατάσταση στο τέλος

### Βήμα 3: Έλεγχος

```sql
SELECT * FROM cron.job WHERE jobname = 'check-stop-arrivals';
```

Αν βλέπεις αποτέλεσμα, το cron job τρέχει! ✅

---

## Επιλογή 2: GitHub Actions (Fallback - Ήδη ενεργό)

Αν το `pg_cron` δεν είναι διαθέσιμο, το **GitHub Actions workflow** θα καλεί το `check-stop-arrivals` function **κάθε 5 λεπτά**.

### Έλεγχος:

1. **GitHub** → **Actions** → **Check Stop Arrivals**
2. Βεβαιώσου ότι το workflow τρέχει

### Manual Trigger:

1. **GitHub** → **Actions** → **Check Stop Arrivals** → **Run workflow**

---

## Επιλογή 3: Manual Test

Για να δοκιμάσεις αν λειτουργεί:

```powershell
.\test-push-simple.ps1
```

Αυτό θα καλέσει το `check-stop-arrivals` function και θα στείλει notifications.

---

## Troubleshooting

### Error: "relation cron.job does not exist"
→ Το `pg_cron` extension δεν είναι διαθέσιμο. Χρησιμοποίησε **Επιλογή 2** (GitHub Actions).

### Error: "Service role key not configured"
→ Αντικατέστησε `YOUR_SERVICE_ROLE_KEY_HERE` με το πραγματικό service_role key.

### Error: "pg_net extension not available"
→ Ενεργοποίησε το `pg_net` extension από το **Database** → **Extensions**.

---

## Current Status

- ✅ Frontend: Working
- ✅ Subscriptions: 2 active
- ✅ Stop notifications: 2 enabled (stops 2877, 3577)
- ⚠️ Cron job: Needs setup (see above)

