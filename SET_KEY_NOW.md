# 🔑 Βάλε το Supabase Key ΤΩΡΑ

## Επιλογή 1: Με Script (Εύκολο)

1. **Πάρε το anon key:**
   - Πήγαινε: https://supabase.com/dashboard/project/mhlyndipnpwpcydjukig/settings/api
   - Αντιγράψε το "anon public" key (ξεκινάει με `eyJ...`)

2. **Τρέξε:**
   ```bash
   node set-supabase-key.js YOUR_ANON_KEY_HERE
   ```

3. **Restart dev server:**
   - Ctrl+C
   - `npm run dev`

## Επιλογή 2: Manual (Αν δεν δουλεύει το script)

1. **Άνοιξε το `.env` file** στο project folder

2. **Βάλε:**
   ```
   VITE_SUPABASE_URL=https://mhlyndipnpwpcydjukig.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=ΕΔΩ_ΒΑΛΕ_ΤΟ_KEY
   ```

3. **Restart dev server**

## Επιλογή 3: Browser Console (Γρήγορο)

1. **Άνοιξε το app** στο browser
2. **F12 → Console**
3. **Τρέξε:**
   ```javascript
   localStorage.setItem('supabase_anon_key', 'YOUR_ANON_KEY_HERE')
   ```
4. **Reload** (F5)

---

**Μετά από οποιαδήποτε επιλογή, το upsert θα δουλεύει! ✅**

