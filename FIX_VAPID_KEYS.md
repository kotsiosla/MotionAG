# 🔧 Διόρθωση: VAPID keys not configured

## ❌ Το πρόβλημα:

Το function λέει "VAPID keys not configured" - αυτό σημαίνει ότι:
- Τα keys δεν είναι προσβάσιμα από το function
- Ή δεν είναι στο σωστό format

---

## ✅ Λύση:

### Βήμα 1: Έλεγχος που είναι τα Keys

Στο Supabase, τα VAPID keys πρέπει να είναι:
- ✅ **Edge Functions → Secrets** (όχι Environment Variables)
- ✅ Ή **Settings → Edge Functions → Environment Variables**

### Βήμα 2: Προσθήκη ως Edge Functions Secrets

1. **Supabase Dashboard** → **Edge Functions** → **Secrets** (αριστερό menu)
2. Κάνε click **"Add new secret"** ή **"New secret"**
3. Προσθήκη:

   **Secret 1:**
   - **Name:** `VAPID_PUBLIC_KEY`
   - **Value:** `BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg`
   - **Save**

   **Secret 2:**
   - **Name:** `VAPID_PRIVATE_KEY`
   - **Value:** `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
   - **Save**

### Βήμα 3: Έλεγχος

Μετά από την προσθήκη:
1. **Edge Functions** → **push-notify** → **Test**
2. Κάνε click **"Send Request"**
3. ✅ Θα πρέπει να λειτουργεί!

---

## 🔍 Αν ακόμα δεν λειτουργεί:

1. **Edge Functions** → **push-notify** → **Logs**
2. Δες το exact error
3. Έλεγξε αν τα keys είναι σωστά formatted (χωρίς spaces, newlines)

---

## 📝 Σημαντικό:

- Τα **Secrets** (Edge Functions → Secrets) είναι διαφορετικά από τα **Environment Variables** (Settings → Edge Functions → Environment Variables)
- Το function διαβάζει από **Secrets** (Edge Functions → Secrets)

---

**Πρόσθεσε τα keys στο Secrets και δοκίμασε ξανά! 🚀**

