# 🚀 Deploy test-push Function

## Το test-push function δεν έχει deploy-αρεί ακόμα

### Επιλογή 1: Deploy με Supabase CLI (Αν έχεις CLI)

```bash
cd C:\Users\kotsi\.cursor\worktrees\chargecyprus\vzj\motionbus
supabase functions deploy test-push
```

### Επιλογή 2: Deploy με Supabase Dashboard

1. **Supabase Dashboard** → **Edge Functions**
2. Κάνε click **"Deploy a new function"**
3. Επίλεξε **"Via Editor"** ή **"Via CLI"**
4. Αν επιλέξεις Editor:
   - Copy-paste τον κώδικα από `supabase/functions/test-push/index.ts`
   - Save και Deploy

### Επιλογή 3: Χρησιμοποίησε το push-notify (Αν λειτουργεί)

Αν το `push-notify` λειτουργεί, μπορείς να το χρησιμοποιήσεις για test.

---

## 🔧 Διόρθωση push-notify Error 500

Το error 500 στο push-notify μπορεί να οφείλεται σε:

1. **VAPID Keys Format:**
   - Τα keys που δημιούργησες με `npx web-push` είναι base64
   - Το function μπορεί να χρειάζεται base64url format

2. **Missing Environment Variables:**
   - Έλεγξε αν τα VAPID keys είναι σωστά στο Secrets

3. **Code Error:**
   - Έλεγξε τα Logs του function για το exact error

---

## 🧪 Quick Test: Χρησιμοποίησε το check-stop-arrivals

Αν θέλεις να δοκιμάσεις αν τα VAPID keys λειτουργούν:

1. **Edge Functions** → **check-stop-arrivals**
2. Κάνε click **"Test"**
3. Έλεγξε τα logs

---

**Προτείνεται:** Deploy το test-push function για πιο εύκολο testing.

