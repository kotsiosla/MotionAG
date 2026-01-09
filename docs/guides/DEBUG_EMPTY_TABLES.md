# 🔍 Debug: Empty Tables

## ⚠️ Το Πρόβλημα:

Τα logs δείχνουν ότι το `upsert` επιστρέφει data, αλλά τα tables είναι empty.

---

## ✅ Τι να Ελέγξεις:

### 1. Έλεγξε το Supabase Project

1. **Supabase Dashboard** → **Settings** → **API**
2. Έλεγξε το **Project URL**
3. Σύγκρινε με το URL που χρησιμοποιεί το app

### 2. Έλεγξε το Supabase Client

1. **Developer Console** (F12)
2. **Console** tab
3. Γράψε: `window.location.origin`
4. Έλεγξε αν το URL ταιριάζει με το Supabase project

### 3. Έλεγξε τα RLS Policies

1. **Supabase Dashboard** → **Authentication** → **Policies**
2. Άνοιξε το table **`stop_notification_subscriptions`**
3. Έλεγξε αν υπάρχουν policies
4. Αν δεν υπάρχουν, τρέξε το `RUN_MIGRATIONS.sql` script

### 4. Έλεγξε αν το Upsert Αποθηκεύει

1. **Developer Console** (F12)
2. **Network** tab
3. **Filter:** `supabase`
4. Ενεργοποίησε notifications
5. Έλεγξε το request:
   - **URL:** Πού στέλνει;
   - **Response:** Τι επιστρέφει;
   - **Status:** 200 ή error;

### 5. Έλεγξε το Database

1. **Supabase Dashboard** → **Table Editor**
2. Άνοιξε το table **`stop_notification_subscriptions`**
3. Κάνε **Refresh**
4. Έλεγξε αν υπάρχουν rows

---

## 🔧 Quick Fix: Re-run Migrations

Αν τα RLS policies δεν υπάρχουν:

1. **Supabase Dashboard** → **SQL Editor**
2. Άνοιξε το **`RUN_MIGRATIONS.sql`** file
3. **Copy** όλο το περιεχόμενο
4. **Paste** στο SQL Editor
5. **Run**

---

## 📋 Next Steps:

1. **Στείλε μου:**
   - Το **Project URL** από το Supabase Dashboard
   - Τα **Network requests** από το Console (αν μπορείς)
   - Αν τα **RLS policies** υπάρχουν

2. **Αν τα RLS policies δεν υπάρχουν:**
   - Τρέξε το `RUN_MIGRATIONS.sql` script
   - Δοκίμασε ξανά

---

**Έλεγξε αυτά και στείλε μου τα αποτελέσματα! 🔍**

