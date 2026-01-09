# 🚀 Deploy check-stop-arrivals Function

## Το function δεν είναι deployed ακόμα!

Το `check-stop-arrivals` function υπάρχει στο codebase αλλά **δεν είναι deployed** στο Supabase.

## 📋 Deploy Options:

### Επιλογή 1: Deploy από Supabase Dashboard (Εύκολο)

1. **Πήγαινε στο Supabase Dashboard:**
   - https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/functions

2. **Create New Function:**
   - Κάνε click **"Create a new function"**
   - Όνομα: `check-stop-arrivals`

3. **Copy-Paste τον κώδικα:**
   - Άνοιξε: `supabase/functions/check-stop-arrivals/index.ts`
   - Copy όλο τον κώδικα
   - Paste στο Supabase Editor
   - Save & Deploy

### Επιλογή 2: Deploy με Supabase CLI (Γρήγορο)

```bash
# Install Supabase CLI (αν δεν το έχεις)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref jftthfniwfarxyisszjh

# Deploy function
supabase functions deploy check-stop-arrivals
```

### Επιλογή 3: Deploy από GitHub Actions (Αυτόματο)

Μπορούμε να προσθέσουμε GitHub Action που deploy αυτόματα όταν push changes.

## ⚙️ Environment Variables (Secrets)

Μετά το deploy, **πρέπει να προσθέσεις Secrets:**

1. Πήγαινε στο **Edge Functions** → `check-stop-arrivals` → **Settings** → **Secrets**

2. Πρόσθεσε:
   - `VAPID_PUBLIC_KEY`: `BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg`
   - `VAPID_PRIVATE_KEY`: `oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso`
   - `SUPABASE_URL`: `https://jftthfniwfarxyisszjh.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: (Πρέπει να το πάρεις από Settings → API → service_role key)

## ✅ Μετά το Deploy:

1. **Test το function:**
   - Invoke από Dashboard
   - Ή curl: `curl -X POST "https://jftthfniwfarxyisszjh.supabase.co/functions/v1/check-stop-arrivals" -H "Authorization: Bearer SERVICE_ROLE_KEY"`

2. **Έλεγξε τα Logs:**
   - Edge Functions → `check-stop-arrivals` → **Logs**
   - Θα δεις: `Found 1 subscriptions`, `Push sent`, etc.

## 🔄 GitHub Actions Workflow

Το `.github/workflows/check-arrivals.yml` θα καλεί αυτό το function κάθε 2 λεπτά, **αλλά μόνο αν είναι deployed!**

---

**Τώρα:** Deploy το function και μετά θα μπορούμε να το test!

