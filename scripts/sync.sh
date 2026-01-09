#!/bin/bash
# Sync script for MotionBus_AI repository
# Usage: ./sync.sh [commit-message]

MESSAGE="${1:-}"

echo "🔄 Syncing MotionBus_AI with GitHub..."

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit. Checking for remote updates..."
    git pull
    echo "✅ Sync complete!"
    exit 0
fi

# Show current status
echo ""
echo "📋 Current changes:"
git status -s

# Get commit message
if [ -z "$MESSAGE" ]; then
    read -p "💬 Enter commit message: " MESSAGE
    if [ -z "$MESSAGE" ]; then
        echo "❌ Commit message is required!"
        exit 1
    fi
fi

# Stage all changes
echo ""
echo "📦 Staging all changes..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "$MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed!"
    exit 1
fi

# Pull first to avoid conflicts
echo "⬇️  Pulling latest changes from GitHub..."
git pull

if [ $? -ne 0 ]; then
    echo "⚠️  Pull had issues. Please resolve conflicts manually."
    exit 1
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully synced with GitHub!"
    echo "🔗 Repository: https://github.com/kotsiosla/MotionBus_AI"
else
    echo ""
    echo "❌ Push failed!"
    exit 1
fi


