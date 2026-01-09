# 🔧 Fix Empty stop_notifications Issue

## 🔍 Problem

Το `stop_notifications` field είναι empty στο table, παρόλο που το upsert φαίνεται να ολοκληρώνεται.

## 🔍 Possible Causes:

1. **JSONB Casting Issue**: Το `stopSettings as any` δεν γίνεται σωστά JSONB
2. **RLS Policy**: Αν και φαίνεται σωστό, μπορεί να μην επιτρέπει update
3. **Upsert Conflict**: Το `onConflict: 'endpoint'` μπορεί να κάνει update αλλά να μην αποθηκεύει το `stop_notifications`

## ✅ Solutions:

### Solution 1: Manual SQL Update (Quick Fix)

1. Πήγαινε στο **SQL Editor** στο Supabase
2. Copy-paste το `FIX_EMPTY_STOP_NOTIFICATIONS.sql`
3. Αντάλλαξε `YOUR_ENDPOINT_HERE` με το actual endpoint από το table
4. Run το SQL

### Solution 2: Fix the Upsert Code

Το πρόβλημα μπορεί να είναι ότι το `stop_notifications` δεν γίνεται σωστά JSONB. Ας το fix-άρουμε:

**Change in `NearbyStopsPanel.tsx`:**

```typescript
// Instead of:
stop_notifications: stopSettings as any,

// Use:
stop_notifications: JSON.parse(JSON.stringify(stopSettings)),
```

Ή καλύτερα, χρησιμοποίησε explicit JSONB casting:

```typescript
const upsertPromise = supabase
  .from('stop_notification_subscriptions')
  .upsert({
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    stop_notifications: stopSettings, // Remove 'as any'
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  .select();
```

### Solution 3: Use RPC Function

Δημιούργησε ένα Supabase function που κάνει upsert με explicit JSONB:

```sql
CREATE OR REPLACE FUNCTION upsert_stop_notification(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_stop_notifications JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.stop_notification_subscriptions (
    endpoint, p256dh, auth, stop_notifications, updated_at
  )
  VALUES (p_endpoint, p_p256dh, p_auth, p_stop_notifications, now())
  ON CONFLICT (endpoint) 
  DO UPDATE SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    stop_notifications = EXCLUDED.stop_notifications,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🧪 Test After Fix:

1. Άνοιξε το app
2. Ενεργοποίησε notifications για μια στάση
3. Έλεγξε το browser console για `✅ Synced tracked stop`
4. Refresh το Supabase table
5. Έλεγξε αν το `stop_notifications` field έχει data
6. Invoke το `check-stop-arrivals` function
7. Έλεγξε τα logs - θα πρέπει να βλέπει `Found 1 subscriptions`

## 📋 Quick Test SQL:

```sql
-- Check current state
SELECT 
  id,
  endpoint,
  stop_notifications,
  CASE 
    WHEN stop_notifications IS NULL THEN 'NULL'
    WHEN stop_notifications::text = '[]' THEN 'EMPTY'
    ELSE 'HAS DATA: ' || jsonb_array_length(stop_notifications)::text
  END as status
FROM public.stop_notification_subscriptions;
```

