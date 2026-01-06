# 🔧 Διόρθωση: VAPID keys not configured

## ❌ Το πρόβλημα:

Το function λέει **"VAPID keys not configured"** - αυτό σημαίνει ότι τα keys δεν είναι προσβάσιμα.

---

## ✅ Λύση:

### Βήμα 1: Έλεγχος Edge Functions Secrets

1. **Supabase Dashboard** → **Edge Functions** → **Secrets** (αριστερό menu, κάτω από "MANAGE")
2. Έλεγξε αν βλέπεις:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

### Βήμα 2: Αν ΔΕΝ τα βλέπεις, πρόσθεσέ τα:

1. Κάνε click **"New secret"** ή **"Add new secret"**
2. Προσθήκη:

   **Secret 1:**
   - **Name:** `VAPID_PUBLIC_KEY`
   - **Value:** `BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg`
   - **Save**

   **Secret 2:**
   - **Name:** `VAPID_PRIVATE_KEY`
   - **Value:** `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
   - **Save**

### Βήμα 3: Redeploy το Function

Μετά την προσθήκη των keys:
1. **Edge Functions** → **push-notify** → **Code**
2. Κάνε click **"Deploy"** ή **"Save"** (για να reload τα environment variables)
3. Περίμενε λίγο

### Βήμα 4: Test

1. **Edge Functions** → **push-notify** → **Test**
2. Κάνε click **"Send Request"** (χωρίς body)
3. ✅ Θα πρέπει να λειτουργεί!

---

## 🔍 Αν ακόμα δεν λειτουργεί:

1. **Edge Functions** → **push-notify** → **Logs**
2. Δες το exact error
3. Έλεγξε αν τα keys είναι σωστά (χωρίς spaces, newlines)

---

## 📝 Σημαντικό:

- Τα keys πρέπει να είναι στο **Edge Functions → Secrets** (όχι Settings → Environment Variables)
- Μετά την προσθήκη, **redeploy** το function

---

**Πρόσθεσε τα keys στο Secrets και redeploy! 🚀**

