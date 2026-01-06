# Sync script for MotionBus_AI repository
# Usage: .\sync.ps1 [commit-message]
# If no message provided, will prompt for one

param(
    [string]$Message = ""
)

Write-Host "🔄 Syncing MotionBus_AI with GitHub..." -ForegroundColor Cyan

# Check if there are any changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ No changes to commit. Checking for remote updates..." -ForegroundColor Green
    git pull
    Write-Host "✅ Sync complete!" -ForegroundColor Green
    exit 0
}

# Show current status
Write-Host "`n📋 Current changes:" -ForegroundColor Yellow
git status -s

# Get commit message
if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = Read-Host "`n💬 Enter commit message"
    if ([string]::IsNullOrWhiteSpace($Message)) {
        Write-Host "❌ Commit message is required!" -ForegroundColor Red
        exit 1
    }
}

# Stage all changes
Write-Host "`n📦 Staging all changes..." -ForegroundColor Yellow
git add .

# Commit changes
Write-Host "💾 Committing changes..." -ForegroundColor Yellow
git commit -m $Message

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

# Pull first to avoid conflicts
Write-Host "⬇️  Pulling latest changes from GitHub..." -ForegroundColor Yellow
git pull

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Pull had issues. Please resolve conflicts manually." -ForegroundColor Yellow
    exit 1
}

# Push to GitHub
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully synced with GitHub!" -ForegroundColor Green
    Write-Host "🔗 Repository: https://github.com/kotsiosla/MotionBus_AI" -ForegroundColor Cyan
}
else {
    Write-Host "`n❌ Push failed!" -ForegroundColor Red
    exit 1
}