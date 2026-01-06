# 🔍 Check Function Logs

## ✅ Function is Deployed!

Το `check-stop-arrivals` function είναι deployed και απαντάει, αλλά λέει `totalInTable: 0`.

## 🔍 Debugging Steps:

### 1. Έλεγξε τα Logs στο Supabase:

1. Πήγαινε στο: https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/functions
2. Κάνε click στο `check-stop-arrivals` function
3. Κάνε click στο **"Logs"** tab
4. Δες τα recent invocations

**Τι να ψάχνεις:**
- `Found X subscriptions` - πόσα subscriptions βρήκε
- `Total subscriptions in table` - πόσα συνολικά στο table
- `stop_notifications_count` - πόσα enabled notifications έχει κάθε subscription

### 2. Έλεγξε το Table:

1. Πήγαινε στο **Table Editor** → `stop_notification_subscriptions`
2. Έλεγξε αν το `stop_notifications` field είναι:
   - ✅ Array με objects (π.χ. `[{"stopId": "2877", ...}]`)
   - ❌ `null`
   - ❌ Empty array `[]`

### 3. Αν το `stop_notifications` είναι null ή empty:

Το query `.not('stop_notifications', 'is', null)` δεν θα το βρει.

**Fix:** Πρέπει να ενεργοποιήσεις notifications από το app και να κάνει upsert με `stop_notifications` populated.

### 4. Test με Manual Invoke:

1. Πήγαινε στο function → **Invoke Function**
2. Δες τα logs real-time
3. Αν βλέπεις `Found 0 subscriptions`, το `stop_notifications` field είναι null ή empty

## 🔧 Possible Issues:

1. **`stop_notifications` is null**: Το upsert δεν έγινε σωστά
2. **`stop_notifications` is empty array**: Το upsert έγινε αλλά με empty array
3. **Query issue**: Το `.not('stop_notifications', 'is', null)` δεν δουλεύει σωστά

## ✅ Solution:

Αν το table έχει row αλλά `stop_notifications` είναι null:
1. Άνοιξε το app
2. Ενεργοποίησε notifications για μια στάση
3. Έλεγξε το browser console για `[NearbyStopsPanel] ✅ Synced tracked stop`
4. Refresh το Supabase table
5. Invoke το function ξανά

