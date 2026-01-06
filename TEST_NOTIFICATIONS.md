# 🧪 Test Notifications - Οδηγίες Δοκιμής

## 🎯 Τρόποι Δοκιμής

### 1️⃣ Test Push Notification (Γρήγορο - 1 λεπτό)

**Αυτό στέλνει test push notification σε όλες τις subscriptions:**

1. **Supabase Dashboard** → **Edge Functions** → **test-push**
2. Κάνε click **"Invoke function"**
3. Θα πρέπει να λάβεις push notification στο device σου

**Ή με curl:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://mhlyndipnpwpcydjukig.supabase.co/functions/v1/test-push
```

---

### 2️⃣ Test GitHub Actions Workflow (Manual Trigger)

1. **GitHub** → **Actions** → **Check Stop Arrivals**
2. Κάνε click **"Run workflow"** → **"Run workflow"**
3. Έλεγξε τα logs για errors

**Expected output:**
```
✅ Success: {"checked": X, "sent": Y}
```

---

### 3️⃣ Test Foreground Notifications (Στο App)

1. Άνοιξε το app στο browser
2. Ενεργοποίησε ειδοποίηση για μια στάση (κουμπί 🔔)
3. Περίμενε να πλησιάσει λεωφορείο
4. Θα πρέπει να:
   - ✅ Ακούσεις ήχο
   - ✅ Δεις toast notification
   - ✅ Λάβεις browser notification (αν έχεις δώσει permission)

---

### 4️⃣ Test Background Notifications (App Minimized)

1. Ενεργοποίησε push notifications για μια στάση
2. Minimize το browser/app
3. Περίμενε push notification (αν έχει upcoming arrival)
4. Κάνε click στο notification → θα ανοίξει το app

---

### 5️⃣ Test Closed App Notifications

1. Ενεργοποίησε push notifications για μια στάση
2. Κλείσε το app/browser
3. Περίμενε push notification (αν έχει upcoming arrival)
4. Κάνε click στο notification → θα ανοίξει το app

---

## 🔍 Έλεγχος Status

### Έλεγχος Subscriptions:
```sql
-- Στο Supabase SQL Editor
SELECT 
  id,
  endpoint,
  jsonb_array_length(stop_notifications::jsonb) as notification_count,
  updated_at
FROM stop_notification_subscriptions;
```

### Έλεγχος GitHub Actions:
- **GitHub** → **Actions** → **Check Stop Arrivals**
- Θα πρέπει να βλέπεις execution history

### Έλεγχος Edge Function Logs:
- **Supabase** → **Edge Functions** → **check-stop-arrivals** → **Logs**
- Θα πρέπει να βλέπεις logs από τις κλήσεις

---

## 🐛 Troubleshooting

### Δεν έρχονται push notifications:
1. ✅ Έλεγξε αν έχεις δώσει permission για notifications
2. ✅ Έλεγξε αν υπάρχει subscription στο database
3. ✅ Έλεγξε αν τα VAPID keys είναι σωστά
4. ✅ Έλεγξε τα logs του edge function

### GitHub Actions fails:
1. ✅ Έλεγξε αν τα secrets είναι σωστά
2. ✅ Έλεγξε τα logs στο GitHub Actions
3. ✅ Έλεγξε αν το service role key έχει permissions

### Foreground notifications δεν λειτουργούν:
1. ✅ Έλεγξε console για errors
2. ✅ Έλεγξε αν το `useStopArrivalNotifications` hook τρέχει
3. ✅ Έλεγξε αν υπάρχουν trips με arrivals

---

## ✅ Checklist

- [ ] Test push notification sent (test-push function)
- [ ] GitHub Actions workflow runs successfully
- [ ] Foreground notifications work (sound, toast, browser notification)
- [ ] Background notifications work (push when minimized)
- [ ] Closed app notifications work (push when closed)
- [ ] Subscriptions exist in database
- [ ] VAPID keys configured
- [ ] Service role key configured

---

## 🚀 Quick Test Commands

### Test 1: Test Push (Fastest)
```bash
# Call test-push function
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://mhlyndipnpwpcydjukig.supabase.co/functions/v1/test-push
```

### Test 2: Check Arrivals
```bash
# Call check-stop-arrivals function
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://mhlyndipnpwpcydjukig.supabase.co/functions/v1/check-stop-arrivals
```

### Test 3: Check Subscriptions
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as total_subscriptions 
FROM stop_notification_subscriptions;
```

---

**Happy Testing! 🎉**


