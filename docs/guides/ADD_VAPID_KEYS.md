# 🔑 Προσθήκη VAPID Keys στο Supabase

## ✅ Τα Keys σου:

**Public Key:**
```
BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg
```

**Private Key:**
```
oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso
```

---

## 📝 Μέθοδος 1: Manual (Supabase Dashboard)

### Βήμα 1: Πήγαινε στα Environment Variables
1. **Supabase Dashboard** → **Settings** → **Edge Functions** → **Environment Variables**

### Βήμα 2: Προσθήκη Public Key
1. Κάνε click **"Add new variable"**
2. **Name:** `VAPID_PUBLIC_KEY`
3. **Value:** `BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg`
4. Κάνε click **"Save"**

### Βήμα 3: Προσθήκη Private Key
1. Κάνε click **"Add new variable"** (ξανά)
2. **Name:** `VAPID_PRIVATE_KEY`
3. **Value:** `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
4. Κάνε click **"Save"**

---

## 🤖 Μέθοδος 2: Με Supabase AI Assistant

### Copy-paste αυτό στο AI Assistant:

```
Πρόσθεσε τα παρακάτω Environment Variables για Edge Functions:

1. VAPID_PUBLIC_KEY = BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg

2. VAPID_PRIVATE_KEY = oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso

Αυτά είναι VAPID keys για push notifications.
```

---

## 💻 Μέθοδος 3: Με Supabase CLI (αν έχεις CLI)

```bash
# Set Public Key
supabase secrets set VAPID_PUBLIC_KEY=BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg

# Set Private Key
supabase secrets set VAPID_PRIVATE_KEY=oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso
```

---

## ✅ Έλεγχος

Μετά από την προσθήκη, θα πρέπει να βλέπεις:
- ✅ `VAPID_PUBLIC_KEY` στη λίστα
- ✅ `VAPID_PRIVATE_KEY` στη λίστα

---

## 🧪 Test

Μετά από την προσθήκη:
1. **Supabase** → **Edge Functions** → **test-push**
2. Κάνε click **"Invoke function"**
3. Θα πρέπει να λάβεις push notification! 🎉

---

**Καλή τύχη! 🚀**

