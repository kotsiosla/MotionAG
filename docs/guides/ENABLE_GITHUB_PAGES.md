# 🌐 Enable GitHub Pages

## ⚠️ Το website δεν ανοίγει

Αυτό σημαίνει ότι το GitHub Pages δεν είναι enabled ακόμα.

## 📋 Βήματα για Enable

### 1. Πήγαινε στο Settings
```
https://github.com/kotsiosla/MotionBus_AI/settings/pages
```

### 2. Source Settings
- **Source**: Επίλεξε **"GitHub Actions"** (όχι "Deploy from a branch")
- Κάνε **Save**

### 3. Περίμενε 1-2 λεπτά
- Το GitHub Pages χρειάζεται λίγο χρόνο για να enable

### 4. Access Website
Μετά το enable, το website θα είναι διαθέσιμο στο:
```
https://kotsiosla.github.io/MotionBus_AI/
```

## 🔍 Verify

### Check if Pages is enabled:
1. Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/settings/pages
2. Θα δεις: "Your site is live at https://kotsiosla.github.io/MotionBus_AI/"

### Check Actions:
1. Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/actions
2. Θα δεις: "Deploy to GitHub Pages" workflow
3. Build job: ✅ Success
4. Deploy job: ✅ Success

## ⚠️ Common Issues

### Issue: "Source" dropdown is empty
- **Solution**: Κάνε push στο main branch πρώτα

### Issue: "GitHub Actions" option not available
- **Solution**: Βεβαιώσου ότι το `.github/workflows/deploy-pages.yml` υπάρχει

### Issue: Website shows 404
- **Solution**: Περίμενε 2-3 λεπτά για CDN propagation

## ✅ Quick Checklist

- [ ] GitHub Pages enabled
- [ ] Source: "GitHub Actions"
- [ ] Build workflow: Success
- [ ] Deploy workflow: Success
- [ ] Website URL: https://kotsiosla.github.io/MotionBus_AI/

## 🚀 After Enable

Μετά το enable:
1. Περίμενε 1-2 λεπτά
2. Άνοιξε: https://kotsiosla.github.io/MotionBus_AI/
3. Test το app!

**Το website θα είναι live σε 1-2 λεπτά! 🎉**

