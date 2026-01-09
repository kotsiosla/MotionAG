# ✅ Προσθήκη VAPID_PRIVATE_KEY

## 📝 Τι να Κάνεις:

### Βήμα 1: Προσθήκη Secret

1. **Supabase Dashboard** → **Edge Functions** → **Secrets** (είσαι ήδη εκεί!)
2. Κάνε click **"New secret"** ή **"Add new secret"** (πράσινο κουμπί)
3. **Name:** `VAPID_PRIVATE_KEY`
4. **Value:** `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
5. **Save**

### Βήμα 2: Redeploy το Function

**ΣΗΜΑΝΤΙΚΟ:** Μετά την προσθήκη, πρέπει να κάνεις redeploy:

1. **Edge Functions** → **push-notify-new** → **Code**
2. Κάνε click **"Deploy"** ή **"Save"**
3. Περίμενε **30-60 δευτερόλεπτα**

### Βήμα 3: Test

1. **Edge Functions** → **push-notify-new** → **Test**
2. Κάνε click **"Send Request"** (με άδειο body `{}`)
3. **Edge Functions** → **push-notify-new** → **Logs**
4. ✅ Θα πρέπει να δεις:
   ```
   DEBUG: Environment check:
   VAPID_PUBLIC_KEY exists: true (length: 87)
   VAPID_PRIVATE_KEY exists: true (length: 43)
   ```

---

## 🎯 Μετά:

Αν και τα δύο keys βρίσκονται, το function θα λειτουργήσει! ✅

---

**Πρόσθεσε το `VAPID_PRIVATE_KEY` και redeploy! 🚀**

