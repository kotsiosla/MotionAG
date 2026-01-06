# 🚀 Deploy to GitHub Pages (ΔΩΡΕΑΝ!)

## ✅ Τι έγινε

1. ✅ Build: Completed
2. ✅ GitHub Actions workflow: Created (`.github/workflows/deploy-pages.yml`)
3. ✅ Ready for deployment

## 📋 Βήματα για Deploy

### 1. Enable GitHub Pages

1. Πήγαινε στο GitHub repository:
   - https://github.com/kotsiosla/MotionBus_AI
2. Settings → Pages
3. Source: Select "GitHub Actions"
4. Save

### 2. Add Secrets (για build)

1. Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `VITE_SUPABASE_URL`: `https://jftthfniwfarxyisszjh.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Το anon key σου

### 3. Push to GitHub

```powershell
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

### 4. Wait for Deployment

1. Πήγαινε στο Actions tab στο GitHub
2. Θα δεις το workflow "Deploy to GitHub Pages"
3. Περίμενε να ολοκληρωθεί (2-3 λεπτά)

### 5. Access Your Website

Μετά το deploy, το website θα είναι διαθέσιμο στο:
- `https://kotsiosla.github.io/MotionBus_AI/`

## 🎯 Auto-Deploy

Κάθε φορά που push-άρεις στο `main` branch:
- ✅ Auto-build
- ✅ Auto-deploy στο GitHub Pages
- ✅ Website update automatic!

## 📝 Notes

- **Δωρεάν**: GitHub Pages είναι 100% δωρεάν
- **HTTPS**: Automatic HTTPS
- **Custom domain**: Μπορείς να προσθέσεις custom domain (optional)
- **Build time**: ~2-3 λεπτά

## 🔧 Troubleshooting

### Αν το build fails:
1. Έλεγξε τα secrets (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
2. Έλεγξε το Actions tab για errors
3. Έλεγξε το build logs

### Αν το website δεν φορτώνει:
1. Περίμενε 1-2 λεπτά (CDN propagation)
2. Clear browser cache
3. Try incognito mode

## ✅ Ready!

**Next step**: Push to GitHub και enable GitHub Pages!

**Website URL**: `https://kotsiosla.github.io/MotionBus_AI/`

🎉 **100% ΔΩΡΕΑΝ!**

