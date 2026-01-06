# 🔑 Πώς να πάρεις το Supabase Anon Key

## Γρήγορη Λύση:

1. **Πήγαινε εδώ:**
   https://supabase.com/dashboard/project/mhlyndipnpwpcydjukig/settings/api

2. **Βρες το "anon public" key** (ξεκινάει με `eyJ...`)

3. **Άνοιξε το `.env` file** στο project folder

4. **Αντέγραψε το key** στο `VITE_SUPABASE_PUBLISHABLE_KEY=`

5. **Restart το dev server** (Ctrl+C και `npm run dev`)

## Done! ✅

Μετά από αυτό, το upsert θα δουλεύει.

