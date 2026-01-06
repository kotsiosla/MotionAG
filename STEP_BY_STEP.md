# 📝 Step-by-Step Οδηγίες

## 🎯 Στόχος: Να λειτουργούν οι ειδοποιήσεις σε όλες τις περιπτώσεις

---

## ΒΗΜΑ 1: GitHub Secrets (2 λεπτά)

### 1.1 Άνοιξε το GitHub
- Πήγαινε: https://github.com/kotsiosla/MotionBus_AI
- Κάνε login αν χρειάζεται

### 1.2 Πήγαινε στα Settings
- Κάνε click στο **"Settings"** (πάνω δεξιά, δίπλα στο profile picture)

### 1.3 Πήγαινε στα Secrets
- Στο αριστερό menu, πήγαινε: **"Secrets and variables"** → **"Actions"**

### 1.4 Προσθήκη Secret 1
- Κάνε click **"New repository secret"**
- **Name:** `SUPABASE_URL`
- **Secret:** `https://mhlyndipnpwpcydjukig.supabase.co`
- Κάνε click **"Add secret"**

### 1.5 Προσθήκη Secret 2
- Κάνε click **"New repository secret"** (ξανά)
- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Secret:** (πρέπει να το βρεις - δες παρακάτω)

**Πώς να βρεις το Service Role Key:**
1. Πήγαινε: https://supabase.com/dashboard
2. Επίλεξε το project σου
3. **Settings** (αριστερό menu) → **API**
4. Κάνε scroll down → **"service_role" key** (το μυστικό key, όχι το public)
5. Κάνε click **"Reveal"** και αντιγράψε το
6. Επιστρέφεις στο GitHub και το βάζεις στο Secret

---

## ΒΗΜΑ 2: VAPID Keys στο Supabase (3 λεπτά)

### 2.1 Άνοιξε το Supabase
- Πήγαινε: https://supabase.com/dashboard
- Επίλεξε το project σου

### 2.2 Δημιούργησε VAPID Keys

**Επιλογή A: Με το generate-vapid-keys function (Προτεινόμενη)**
1. **Edge Functions** (αριστερό menu)
2. Βρες το **"generate-vapid-keys"**
3. Κάνε click **"Invoke function"**
4. Αντιγράψε τα 2 keys που θα δεις (public και private)

**Επιλογή B: Με online tool**
1. Πήγαινε: https://web-push-codelab.glitch.me/
2. Κάνε click **"Generate Keys"**
3. Αντιγράψε τα 2 keys

### 2.3 Προσθήκη στο Supabase
1. **Settings** → **Edge Functions** → **Environment Variables**
2. Κάνε click **"Add new variable"**

**Variable 1:**
- **Name:** `VAPID_PUBLIC_KEY`
- **Value:** (το public key που αντιγράψες)
- Κάνε click **"Save"**

**Variable 2:**
- **Name:** `VAPID_PRIVATE_KEY`
- **Value:** (το private key που αντιγράψες)
- Κάνε click **"Save"**

---

## ΒΗΜΑ 3: Test (1 λεπτό)

### 3.1 Test Push Notification
1. **Supabase Dashboard** → **Edge Functions** → **test-push**
2. Κάνε click **"Invoke function"**
3. Θα πρέπει να λάβεις push notification στο device σου! 🎉

### 3.2 Test GitHub Actions
1. **GitHub** → **Actions** tab
2. Βρες το **"Check Stop Arrivals"** workflow
3. Κάνε click **"Run workflow"** → **"Run workflow"**
4. Περίμενε λίγο και έλεγξε τα logs

---

## ✅ Έλεγχος

### Έλεγχος 1: GitHub Secrets
- GitHub → Settings → Secrets → Actions
- Θα πρέπει να βλέπεις 2 secrets: `SUPABASE_URL` και `SUPABASE_SERVICE_ROLE_KEY`

### Έλεγχος 2: VAPID Keys
- Supabase → Settings → Edge Functions → Environment Variables
- Θα πρέπει να βλέπεις 2 variables: `VAPID_PUBLIC_KEY` και `VAPID_PRIVATE_KEY`

### Έλεγχος 3: GitHub Actions
- GitHub → Actions → Check Stop Arrivals
- Θα πρέπει να βλέπεις το workflow να τρέχει (κάθε 2 λεπτά)

---

## 🎉 Τέλος!

Αν όλα είναι OK:
- ✅ **Foreground:** Όλα λειτουργούν (ήχος, δόνηση, φωνή, push)
- ✅ **Background:** Push notifications κάθε 2 λεπτά
- ✅ **Closed:** Push notifications κάθε 2 λεπτά

---

## 🆘 Αν κάτι δεν δουλεύει:

1. **Δεν έρχονται push notifications:**
   - Έλεγξε αν έχεις δώσει permission στο browser
   - Έλεγξε τα logs στο Supabase → Edge Functions → Logs

2. **GitHub Actions fails:**
   - Έλεγξε αν τα secrets είναι σωστά
   - Έλεγξε τα logs στο GitHub Actions

3. **VAPID keys error:**
   - Έλεγξε αν τα keys είναι σωστά formatted
   - Δοκίμασε να τα δημιουργήσεις ξανά

---

**Καλή τύχη! 🚀**

