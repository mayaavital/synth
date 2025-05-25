#!/bin/bash

# Synth App Deployment Script
# This script prepares the app for production deployment on Vercel

set -e  # Exit on any error

echo "🚀 Preparing Synth App for Production Deployment"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if production config exists
if [ ! -f "app.config.production.js" ]; then
    echo "❌ Error: app.config.production.js not found. Please create it first."
    exit 1
fi

# Backup current config if it exists
if [ -f "app.config.js" ]; then
    echo "📦 Backing up current app.config.js to app.config.development.js"
    mv app.config.js app.config.development.js
fi

# Use production config
echo "🔧 Setting up production configuration"
cp app.config.production.js app.config.js

# Install dependencies
echo "📥 Installing dependencies"
npm install

# Test web build
echo "🧪 Testing web build"
npx expo export -p web

if [ $? -eq 0 ]; then
    echo "✅ Web build successful!"
else
    echo "❌ Web build failed. Please check the errors above."
    exit 1
fi

# Check for required environment variables
echo "🔍 Checking environment variables"
missing_vars=()

required_vars=(
    "FIREBASE_API_KEY"
    "FIREBASE_AUTH_DOMAIN"
    "FIREBASE_PROJECT_ID"
    "SPOTIFY_CLIENT_ID"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "⚠️  Warning: The following environment variables are not set:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo "   Make sure to set these in Vercel dashboard."
else
    echo "✅ All required environment variables are set"
fi

# Verify vercel.json exists
if [ ! -f "vercel.json" ]; then
    echo "❌ Error: vercel.json not found. This file is required for deployment."
    exit 1
else
    echo "✅ vercel.json found"
fi

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "Next steps:"
echo "1. Commit and push your changes to GitHub"
echo "2. Import your repository in Vercel"
echo "3. Set environment variables in Vercel dashboard"
echo "4. Update Spotify redirect URI with your Vercel URL"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md" 