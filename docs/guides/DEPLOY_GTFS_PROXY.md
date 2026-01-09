# 🚌 Deploy GTFS-Proxy Function

## ⚠️ Problem:
Το GTFS API είναι offline γιατί το `gtfs-proxy` function δεν είναι deployed.

## 📋 Solution:

### Deploy το `gtfs-proxy` function:

1. **Πήγαινε στο Supabase Dashboard:**
   - https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/functions

2. **Create New Function:**
   - Κάνε click **"Create a new function"**
   - Όνομα: `gtfs-proxy`

3. **Copy-Paste τον κώδικα:**
   - Άνοιξε: `supabase/functions/gtfs-proxy/index.ts`
   - Copy όλο τον κώδικα (είναι μεγάλο αρχείο, ~2600 lines)
   - Paste στο Supabase Editor
   - Save & Deploy

### ⚙️ Function Configuration:

Το function δεν χρειάζεται special secrets - χρησιμοποιεί:
- `GTFS_RT_BASE_URL`: `http://20.19.98.194:8328/Api/api/gtfs-realtime`
- `SIRI_WS_URL`: `http://20.19.98.194:8313/SiriWS.asmx`

(Αυτά είναι hardcoded στο function, δεν χρειάζονται secrets)

### ✅ After Deploy:

1. **Test το function:**
   ```bash
   curl "https://jftthfniwfarxyisszjh.supabase.co/functions/v1/gtfs-proxy/trips?operator=all" \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

2. **Refresh το app:**
   - Reload το browser
   - Τα λεωφορεία θα πρέπει να εμφανίζονται

### 🔍 Verify:

- Function deployed: ✅
- App shows buses: ✅
- GTFS API working: ✅

## 📝 Note:

Το `gtfs-proxy` function είναι **κρίσιμο** για το app - χωρίς αυτό, δεν μπορεί να λάβει real-time bus data.

