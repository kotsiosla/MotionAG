# 🧪 Test Push Notification - Τώρα!

## Βήμα 1: Έλεγξε το `stop_notification_subscriptions` table

1. Πήγαινε στο Supabase Dashboard
2. Table Editor → `stop_notification_subscriptions`
3. Έλεγξε αν έχει rows με `stop_notifications` field populated

## Βήμα 2: Test Push Notification

### Επιλογή A: Invoke από Supabase Dashboard

1. Πήγαινε στο **Edge Functions** → `check-stop-arrivals`
2. Κάνε **Invoke Function**
3. Δες τα logs - θα δεις:
   - `Found X subscriptions`
   - `Sending push to: ...`
   - `Push succeeded` ή `Push failed`

### Επιλογή B: Test με curl

```bash
curl -X POST "https://jftthfniwfarxyisszjh.supabase.co/functions/v1/check-stop-arrivals" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Επιλογή C: Test από GitHub Actions

1. Πήγαινε στο GitHub → Actions
2. Βρες το workflow **Check Stop Arrivals**
3. Κάνε **Run workflow** → **Run workflow**
4. Δες τα logs

## Βήμα 3: Έλεγξε το Browser Console

Αν έχεις το app ανοιχτό:
- Άνοιξε Developer Tools (F12)
- Console tab
- Δες αν υπάρχουν errors ή logs από το `NearbyStopsPanel`

## Βήμα 4: Έλεγξε τα Logs στο Supabase

1. Πήγαινε στο **Edge Functions** → `check-stop-arrivals` → **Logs**
2. Δες τα recent invocations
3. Αν βλέπεις `Found 0 subscriptions`, το `stop_notification_subscriptions` είναι άδειο

## 🔍 Debugging

Αν το `stop_notification_subscriptions` είναι άδειο:

1. Άνοιξε το app στο browser
2. Ενεργοποίησε push notifications για μια στάση
3. Άνοιξε Console (F12)
4. Δες τα logs από `[NearbyStopsPanel]`
5. Αν βλέπεις `✅ Synced tracked stop`, το upsert ολοκληρώθηκε
6. Refresh το Supabase Table Editor

## ✅ Success Criteria

- ✅ `stop_notification_subscriptions` έχει 1+ rows
- ✅ `stop_notifications` field έχει array με enabled notifications
- ✅ `check-stop-arrivals` βρίσκει subscriptions
- ✅ Push notifications στέλνονται (200 status)

