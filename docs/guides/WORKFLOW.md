# MotionBus_AI - Workflow Guide

## 🔗 Repository
**GitHub:** https://github.com/kotsiosla/MotionBus_AI

## 🚀 Quick Sync to GitHub

### Option 1: Using the Sync Script (Recommended)

**PowerShell (Windows):**
```powershell
.\sync.ps1 "Your commit message here"
```

**Bash/Linux/Mac:**
```bash
./sync.sh "Your commit message here"
```

If you don't provide a message, it will prompt you for one.

### Option 2: Manual Git Commands

```bash
# 1. Stage all changes
git add .

# 2. Commit with message
git commit -m "Description of your changes"

# 3. Pull latest changes (to avoid conflicts)
git pull

# 4. Push to GitHub
git push
```

## 📋 Common Workflows

### Making Changes and Syncing

1. **Edit files** in your local repository
2. **Run sync script:**
   ```powershell
   .\sync.ps1 "Added new feature"
   ```
3. **Done!** Changes are now on GitHub

### Checking Status

```bash
# See what files have changed
git status

# See detailed changes
git diff

# See commit history
git log --oneline
```

### Getting Latest Changes from GitHub

```bash
# Pull latest changes
git pull

# Or use the sync script (it will pull if no local changes)
.\sync.ps1
```

### Creating a New Branch

```bash
# Create and switch to new branch
git checkout -b feature/new-feature

# Make changes, then sync
.\sync.ps1 "New feature added"

# Push new branch to GitHub
git push -u origin feature/new-feature
```

## 🛠️ Development Commands

```bash
# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📝 Git Configuration

The repository is configured with:
- **Remote:** `origin` → `https://github.com/kotsiosla/MotionBus_AI.git`
- **Main branch:** `main` (tracking `origin/main`)
- **Large file support:** HTTP post buffer increased for large pushes

## 🔧 Troubleshooting

### If push fails:
1. Check your internet connection
2. Make sure you're authenticated with GitHub
3. Try: `git push -u origin main`

### If you have conflicts:
1. Pull first: `git pull`
2. Resolve conflicts in the files
3. Stage resolved files: `git add .`
4. Commit: `git commit -m "Resolved conflicts"`
5. Push: `git push`

### If sync script doesn't work:
Make sure it's executable (Linux/Mac):
```bash
chmod +x sync.sh
```

## 📚 Additional Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Repository on GitHub](https://github.com/kotsiosla/MotionBus_AI)


