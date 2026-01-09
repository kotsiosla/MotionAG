# 🚀 Quick Start - Background Notifications

## ✅ Τι έχει γίνει ήδη:

1. ✅ **GitHub Actions Workflow** - Δημιουργήθηκε (`.github/workflows/check-arrivals.yml`)
2. ✅ **Edge Function** - `check-stop-arrivals` υπάρχει και είναι έτοιμο
3. ✅ **Service Worker** - Ρυθμισμένο για push notifications
4. ✅ **Client-side Code** - Όλα τα hooks και components είναι έτοιμα

## 🔧 Τι χρειάζεται να κάνεις (2 βήματα):

### Βήμα 1: GitHub Secrets (2 λεπτά)

1. Πήγαινε στο GitHub repository: https://github.com/kotsiosla/MotionBus_AI
2. **Settings** → **Secrets and variables** → **Actions**
3. Κάνε click **"New repository secret"**
4. Προσθήκη 2 secrets:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://mhlyndipnpwpcydjukig.supabase.co`

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (το service role key σου από Supabase Dashboard → Settings → API)

### Βήμα 2: VAPID Keys στο Supabase (3 λεπτά)

1. Πήγαινε στο Supabase Dashboard: https://supabase.com/dashboard
2. Επίλεξε το project σου
3. **Settings** → **Edge Functions** → **Environment Variables**
4. Προσθήκη 2 variables:

   **Variable 1:**
   - Key: `VAPID_PUBLIC_KEY`
   - Value: (δημιούργησε με το `generate-vapid-keys` function ή online tool)

   **Variable 2:**
   - Key: `VAPID_PRIVATE_KEY`
   - Value: (το private key)

#### Πώς να δημιουργήσεις VAPID Keys:

**Επιλογή A: Χρησιμοποίησε το generate-vapid-keys function**
1. Supabase Dashboard → **Edge Functions** → **generate-vapid-keys**
2. Καλέσε το function
3. Αντιγράψε τα keys

**Επιλογή B: Online Tool**
1. Πήγαινε: https://web-push-codelab.glitch.me/
2. Κάνε click **"Generate Keys"**
3. Αντιγράψε τα keys

## ✅ Έλεγχος:

### 1. Έλεγχος GitHub Actions:
- Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/actions
- Θα πρέπει να βλέπεις το workflow **"Check Stop Arrivals"**
- Θα τρέχει αυτόματα κάθε 2 λεπτά

### 2. Έλεγχος Supabase Logs:
- Supabase Dashboard → **Edge Functions** → **check-stop-arrivals** → **Logs**
- Θα πρέπει να βλέπεις logs από τις κλήσεις

### 3. Test Push Notification:
1. Άνοιξε το app
2. Ενεργοποίησε ειδοποίηση για μια στάση (κουμπί 🔔)
3. Κλείσε το app
4. Περίμενε push notification (αν έχει upcoming arrival)

## 📊 Status:

| Component | Status |
|-----------|--------|
| GitHub Actions Workflow | ✅ Created |
| Edge Function | ✅ Ready |
| Service Worker | ✅ Ready |
| Client Code | ✅ Ready |
| GitHub Secrets | ⚠️ Needs Setup |
| VAPID Keys | ⚠️ Needs Setup |

## 🎯 Αποτέλεσμα:

Μόλις ολοκληρώσεις τα 2 βήματα:
- ✅ **Foreground:** Όλα λειτουργούν (ήχος, δόνηση, φωνή, push)
- ✅ **Background (minimized):** Push notifications κάθε 2 λεπτά
- ✅ **Closed:** Push notifications κάθε 2 λεπτά

**Όλα 100% δωρεάν!** 🎉

---

**Βοήθεια:** Αν έχεις πρόβλημα, δες το `SETUP_BACKGROUND_NOTIFICATIONS.md` για detailed instructions.


