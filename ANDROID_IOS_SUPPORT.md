# 📱 Android & iOS Support για Push Notifications

## ✅ Android (Chrome/Firefox)

**Πλήρως υποστηριζόμενο!**

### Chrome Android:
- ✅ **Service Worker**: Υποστηρίζεται
- ✅ **Push Notifications**: Υποστηρίζεται (foreground, background, closed)
- ✅ **Background Notifications**: Ναι (μέσω GitHub Actions + Supabase)
- ✅ **Sound/Vibration**: Ναι
- ✅ **Voice Announcements**: Ναι

### Firefox Android:
- ✅ **Service Worker**: Υποστηρίζεται
- ✅ **Push Notifications**: Υποστηρίζεται
- ✅ **Background Notifications**: Ναι

### Πώς να test-άρεις στο Android:
1. Άνοιξε Chrome στο Android
2. Πήγαινε: `https://kotsiosla.github.io/MotionBus_AI/`
3. Κάνε "Add to Home Screen" (PWA install)
4. Άνοιξε το PWA
5. Κάνε enable notification για μια στάση
6. Περίμενε για bus arrival
7. Θα λάβεις push notification!

## ⚠️ iOS Safari

**Μερικώς υποστηριζόμενο**

### iOS Safari:
- ✅ **Service Worker**: Υποστηρίζεται (iOS 16.4+)
- ❌ **Web Push Notifications**: Δεν υποστηρίζεται (iOS limitation)
- ✅ **Client-side Notifications**: Ναι (μόνο όταν το app είναι ανοιχτό)
- ✅ **Sound/Vibration**: Ναι (μόνο όταν το app είναι ανοιχτό)
- ✅ **Voice Announcements**: Ναι (μόνο όταν το app είναι ανοιχτό)

### Πώς λειτουργεί στο iOS:
- **App Open**: ✅ Όλες οι ειδοποιήσεις δουλεύουν (sound, vibration, voice, toast)
- **App Minimized**: ❌ Δεν λειτουργούν push notifications (iOS Safari limitation)
- **App Closed**: ❌ Δεν λειτουργούν push notifications (iOS Safari limitation)

### Για background notifications στο iOS:
Χρειάζεται **native iOS app** (Swift/Objective-C) - αυτό είναι limitation του iOS Safari, όχι bug.

## 📊 Summary Table

| Platform | Browser | Foreground | Background | Closed | Notes |
|----------|---------|------------|------------|--------|-------|
| **Android** | Chrome | ✅ | ✅ | ✅ | Full support |
| **Android** | Firefox | ✅ | ✅ | ✅ | Full support |
| **Android** | Edge | ✅ | ✅ | ✅ | Full support |
| **iOS** | Safari | ✅ | ❌ | ❌ | iOS limitation |
| **Desktop** | Chrome | ✅ | ✅ | ✅ | Full support |
| **Desktop** | Firefox | ✅ | ✅ | ✅ | Full support |
| **Desktop** | Edge | ✅ | ✅ | ✅ | Full support |

## 🔧 Current Status

### Service Worker:
- ✅ **Minimal service worker** - μόνο push notifications, όχι caching
- ✅ **No refresh loops** - απλοποιημένο για σταθερότητα
- ✅ **Manual registration** - στο `main.tsx`

### Push Notifications:
- ✅ **VAPID keys** configured
- ✅ **Supabase Edge Function** deployed (`check-stop-arrivals`)
- ✅ **GitHub Actions** - runs every 5 minutes
- ✅ **Database tables** - `stop_notification_subscriptions`

### Testing:
1. **Android Chrome**: ✅ Should work perfectly
2. **Android Firefox**: ✅ Should work perfectly
3. **iOS Safari**: ⚠️ Only when app is open

## 🚀 Next Steps για Testing:

### Android:
1. Άνοιξε Chrome στο Android
2. Πήγαινε: `https://kotsiosla.github.io/MotionBus_AI/`
3. Install as PWA
4. Enable notification για μια στάση
5. Περίμενε για bus arrival
6. Θα λάβεις push notification!

### iOS:
1. Άνοιξε Safari στο iOS
2. Πήγαινε: `https://kotsiosla.github.io/MotionBus_AI/`
3. Install as PWA (Add to Home Screen)
4. Enable notification για μια στάση
5. **Κράτα το app ανοιχτό** - οι ειδοποιήσεις θα λειτουργούν μόνο όταν είναι ανοιχτό

---

*Last updated: 2026-01-07*
*Website: https://kotsiosla.github.io/MotionBus_AI/*

