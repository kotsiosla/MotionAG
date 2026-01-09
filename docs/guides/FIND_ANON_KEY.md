# 🔑 Πού βρίσκω τον Anon Key

## 📍 Location

### Supabase Dashboard → API Settings

1. **Πήγαινε στο:**
   ```
   https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/settings/api
   ```

2. **Στο section "Project API keys":**
   - Βρες το **"anon public"** key
   - Είναι ένα long string που ξεκινάει με `eyJ...`
   - Κάνε **Copy** (κουμπί δίπλα στο key)

## 📋 Πώς να το χρησιμοποιήσεις

### 1. GitHub Secrets (για deployment)

1. Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/settings/secrets/actions
2. New repository secret
3. Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Value: Paste το anon key
5. Add secret

### 2. .env file (για local development)

Το `.env` file ήδη έχει το key, αλλά αν χρειάζεται να το ενημερώσεις:

```env
VITE_SUPABASE_URL=https://jftthfniwfarxyisszjh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔍 Visual Guide

Στο Supabase Dashboard θα δεις:

```
Project API keys
├── anon public (public)
│   └── eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... [Copy]
└── service_role (secret)
    └── eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... [Copy]
```

**Χρειάζεσαι το "anon public" key!**

## ⚠️ Important

- **anon public**: Χρησιμοποιείται στο frontend (safe για public)
- **service_role**: ΜΟΝΟ για server-side (ποτέ στο frontend!)

## ✅ Quick Link

**Direct link to API settings:**
https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/settings/api

