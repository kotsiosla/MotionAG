# 🔍 Debug: Upsert Hanging

## ⚠️ Το Πρόβλημα:

Το upsert ξεκινάει (`📤 Calling supabase.upsert...`) αλλά δεν επιστρέφει response.

---

## ✅ Τι να Ελέγξεις:

### 1. Network Tab

1. **Developer Console** (F12) → **Network** tab
2. **Filter:** `supabase` ή `rest`
3. **Clear** το network log
4. **Ενεργοποίησε** notifications
5. **Έλεγξε** αν υπάρχει request:
   - **URL:** Πού στέλνει;
   - **Status:** 200, 400, 500, ή pending;
   - **Response:** Τι επιστρέφει;

### 2. Console Logs

Μετά από 10 δευτερόλεπτα, έλεγξε αν βλέπεις:
- `⏱️ Upsert timed out` (αν κολλάει)
- `📥 Upsert response received` (αν ολοκληρώνεται)

### 3. Table Editor

1. **Supabase Dashboard** → **Table Editor**
2. **Άνοιξε** `stop_notification_subscriptions`
3. **Κάνε Refresh**
4. **Έλεγξε** αν υπάρχουν rows (ακόμα και αν το upsert φαίνεται να κολλάει)

---

## 🔧 Αν το Request είναι Pending:

### Επιλογή 1: CORS Issue

Αν το request είναι pending, μπορεί να είναι CORS issue. Έλεγξε:
1. **Network tab** → **Request Headers**
2. Αν υπάρχει `Access-Control-Allow-Origin` header

### Επιλογή 2: RLS Policy Blocking

Αν το request επιστρέφει 403, το RLS policy μπλοκάρει. Έλεγξε:
1. **Supabase Dashboard** → **Authentication** → **Policies**
2. **Έλεγξε** αν το policy "Anyone can manage their push subscription" υπάρχει

### Επιλογή 3: Network Timeout

Αν το request κολλάει, μπορεί να είναι network issue. Δοκίμασε:
1. **Refresh** το page
2. **Δοκίμασε** από άλλο network
3. **Έλεγξε** αν το Supabase project είναι online

---

## 📋 Next Steps:

1. **Άνοιξε** το Network tab
2. **Ενεργοποίησε** notifications
3. **Έλεγξε** το request:
   - **URL**
   - **Status**
   - **Response**
4. **Στείλε μου** screenshots ή logs

---

**Άνοιξε το Network tab και στείλε μου τι βλέπεις! 🔍**

