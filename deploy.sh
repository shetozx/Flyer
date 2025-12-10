#!/bin/bash

# FlyerChat Deployment Script 🦋

echo "🚀 Initializing Deployment..."

# 1. Initialize Git
git init
git add .
git commit -m "Initial deploy of FlyerChat 🦋"
git branch -M main

# 2. Create GitHub Repository
# Change 'flyer-chat-app' to a unique name if this fails!
REPO_NAME="flyer-chat-app-$RANDOM"

echo "📦 Creating repository: $REPO_NAME"
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push

# 3. Enable GitHub Pages
echo "✨ Enabling GitHub Pages..."
# Get the full repo name (User/Repo)
FULL_REPO=$(gh repo view --json owner,name --template "{{.owner.login}}/{{.name}}")

gh api "repos/$FULL_REPO/pages" -f source='{"branch":"main","path":"/"}'

echo "✅ Deployment Successful!"
echo "🌍 Your app will be live at: https://$(gh api user -q .login).github.io/$(gh repo view --json name -q .name)/"
