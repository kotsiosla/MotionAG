# 🔍 Debug: VAPID Keys Not Found

## ✅ Τι Έγινε:

Πρόσθεσα **debug logging** στο function για να δούμε τι βρίσκει.

---

## 🔧 Βήματα:

### Βήμα 1: Update το Function

1. **Supabase Dashboard** → **Edge Functions** → **push-notify** → **Code**
2. Αντιγράψε τον **ολόκληρο** κώδικα από το `index.ts` που σου έδωσα
3. **Save** / **Deploy**

### Βήμα 2: Test και Έλεγχος Logs

1. **Edge Functions** → **push-notify** → **Test**
2. Κάνε click **"Send Request"** (με άδειο body `{}`)
3. **Edge Functions** → **push-notify** → **Logs**
4. Δες το **DEBUG output** - θα δείξει:
   - Αν βρίσκει τα VAPID keys
   - Τα lengths των keys
   - Όλα τα environment variables που περιέχουν "VAPID" ή "SUPABASE"

### Βήμα 3: Αν ΔΕΝ Βρίσκει τα Keys

Αν τα logs δείχνουν ότι **ΔΕΝ** βρίσκει τα keys:

**Επιλογή A: Προσθήκη στο Environment Variables (Settings)**
1. **Settings** → **Edge Functions** → **Environment Variables**
2. Προσθήκη:
   - `VAPID_PUBLIC_KEY` = `BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg`
   - `VAPID_PRIVATE_KEY` = `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
3. **Redeploy** το function

**Επιλογή B: Έλεγχος Secrets Format**
1. **Edge Functions** → **Secrets**
2. Κάνε click στο `VAPID_PUBLIC_KEY` → **Edit**
3. Βεβαιώσου ότι:
   - Δεν έχει spaces
   - Δεν έχει newlines
   - Είναι το σωστό key
4. **Save** και **Redeploy**

---

## 📝 Expected Debug Output:

**Αν βρίσκει τα keys:**
```
DEBUG: Environment check:
VAPID_PUBLIC_KEY exists: true (length: 87)
VAPID_PRIVATE_KEY exists: true (length: 43)
```

**Αν ΔΕΝ βρίσκει:**
```
DEBUG: Environment check:
VAPID_PUBLIC_KEY exists: false
VAPID_PRIVATE_KEY exists: false
allEnvKeys: [...]
```

---

**Update το function, test, και πες μου τι βλέπεις στα Logs! 🔍**

