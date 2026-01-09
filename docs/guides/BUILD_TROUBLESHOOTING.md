# 🔧 Build Troubleshooting

## ❌ Build Fails - Common Issues

### 1. Missing Secrets

**Error**: Build fails with "VITE_SUPABASE_PUBLISHABLE_KEY is missing"

**Solution**:
1. Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/settings/secrets/actions
2. Add repository secret:
   - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Value: Το anon key από Supabase
3. Re-run workflow

### 2. Check Build Logs

1. Πήγαινε: https://github.com/kotsiosla/MotionBus_AI/actions
2. Κάνε click στο failed workflow
3. Κάνε click στο "build" job
4. Δες τα logs για το exact error

### 3. Common Errors

#### Error: "Cannot find module"
- **Solution**: Run `npm ci` locally, check for missing dependencies

#### Error: "VITE_SUPABASE_URL is not defined"
- **Solution**: Add secret `VITE_SUPABASE_URL` (optional, has fallback)

#### Error: "Build timeout"
- **Solution**: Normal for first build, wait longer

### 4. Manual Build Test

Test locally first:
```powershell
npm ci
npm run build
```

If local build works, the issue is with GitHub Actions secrets.

## ✅ Quick Fix

1. **Add Secrets**:
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your anon key
   - `VITE_SUPABASE_URL`: `https://jftthfniwfarxyisszjh.supabase.co` (optional)

2. **Re-run Workflow**:
   - Actions → Deploy to GitHub Pages → Re-run

## 📋 Check List

- [ ] Secrets are set in GitHub
- [ ] Local build works (`npm run build`)
- [ ] No syntax errors in code
- [ ] All dependencies in package.json

## 🔍 Get Exact Error

1. Go to: https://github.com/kotsiosla/MotionBus_AI/actions
2. Click on failed workflow
3. Click on "build" job
4. Scroll to bottom for error message
5. Copy the error and check this guide

