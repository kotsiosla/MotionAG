# 🔧 Auto Fix & Test Script

## 🚀 Quick Fix Function

Δημιούργησα ένα Edge Function `fix-stop-notifications` που:
- ✅ Ελέγχει όλα τα subscriptions
- ✅ Βρίσκει αυτά με null/empty `stop_notifications`
- ✅ Τα κάνει fix αυτόματα

## 📋 Steps:

### 1. Deploy το fix function:

**Option A: Via Supabase Dashboard**
1. Πήγαινε στο: https://supabase.com/dashboard/project/jftthfniwfarxyisszjh/functions
2. Create new function → `fix-stop-notifications`
3. Copy-paste τον κώδικα από `supabase/functions/fix-stop-notifications/index.ts`
4. Deploy

**Option B: Via CLI**
```bash
supabase functions deploy fix-stop-notifications
```

### 2. Invoke το fix function:

```bash
curl -X POST "https://jftthfniwfarxyisszjh.supabase.co/functions/v1/fix-stop-notifications" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Response:**
```json
{
  "message": "Checked X subscriptions",
  "fixed": 0,
  "total": X,
  "results": [...]
}
```

### 3. Test το check-stop-arrivals:

```bash
curl -X POST "https://jftthfniwfarxyisszjh.supabase.co/functions/v1/check-stop-arrivals" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected after fix:**
```json
{
  "checked": 1,
  "sent": 0  // or > 0 if there are matching arrivals
}
```

## 🔄 Alternative: Manual SQL Fix

Αν δεν θες να deploy function, μπορείς να τρέξεις το SQL:

1. Πήγαινε στο **SQL Editor** στο Supabase
2. Copy-paste το `FIX_EMPTY_STOP_NOTIFICATIONS.sql`
3. Run

## ✅ Complete Test Flow:

1. **Fix empty notifications** → Invoke `fix-stop-notifications`
2. **Test check function** → Invoke `check-stop-arrivals`
3. **Check logs** → Edge Functions → Logs tab
4. **Verify table** → Table Editor → `stop_notification_subscriptions`

## 🎯 Success Criteria:

- ✅ `fix-stop-notifications` reports `fixed: 1` (or more)
- ✅ `check-stop-arrivals` reports `checked: 1` (or more)
- ✅ Table shows `stop_notifications` with data
- ✅ Logs show `Found X subscriptions`

