# Synth App - Vercel Deployment Guide

## Prerequisites

- Vercel account
- Spotify Developer account
- Firebase project (for analytics)

## Environment Variables for Vercel

### Required Environment Variables

Copy these to your Vercel project's Environment Variables section:

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyDrC81tsxyc5QVy2cnrq9H1m0ZJW_7bgAQ
FIREBASE_AUTH_DOMAIN=synth-database.firebaseapp.com
FIREBASE_DATABASE_URL=https://synth-database-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=synth-database
FIREBASE_STORAGE_BUCKET=synth-database.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=681571197393
FIREBASE_APP_ID=1:681571197393:ios:3bb43942f6e6a5692740f0
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Spotify Configuration
SPOTIFY_CLIENT_ID=44bc87fe29004136b77183319f56338e
SPOTIFY_REDIRECT_URI_WEB=https://your-vercel-app.vercel.app

# Environment
NODE_ENV=production
```

## Step-by-Step Deployment

### 1. Prepare Your Repository

1. **Use the production config:**
   ```bash
   # Rename current config
   mv app.config.js app.config.development.js
   
   # Use production config
   mv app.config.production.js app.config.js
   ```

2. **Remove Next.js conflicts (if any):**
   ```bash
   # Move conflicting files that cause Vercel to detect as Next.js
   mv pages pages.backup
   mv next.config.js next.config.js.backup
   rm -rf .next
   ```

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add production configuration for Vercel"
   git push
   ```

### 2. Deploy to Vercel

1. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - **Important:** Do NOT select "Next.js" as framework

2. **Configure Build Settings:**
   - Framework Preset: **Other** or **Create React App**
   - Build Command: `npm install --legacy-peer-deps && npx expo export -p web`
   - Output Directory: `dist`
   - Install Command: `npm install --legacy-peer-deps`

3. **Add Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add each variable from the list above
   - Make sure to check "Production", "Preview", and "Development"

### 3. Update External Services

#### Spotify Developer Dashboard
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Add your Vercel URL to "Redirect URIs":
   ```
   https://your-vercel-app.vercel.app
   ```
5. Save changes

#### Firebase Console (Optional)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Authentication → Settings → Authorized domains
4. Add your Vercel domain:
   ```
   your-vercel-app.vercel.app
   ```

### 4. Update Environment Variables

After your first deployment, update the Spotify redirect URI with your actual Vercel URL:

```bash
SPOTIFY_REDIRECT_URI_WEB=https://your-actual-vercel-url.vercel.app
```

## Build Verification

### Local Web Build Test
Before deploying, test the web build locally:

```bash
# Install dependencies with legacy peer deps
npm install --legacy-peer-deps

# Test web build
npx expo export -p web

# Serve locally (optional)
npx serve dist
```

### Production Build Test
```bash
# Set production environment
export NODE_ENV=production

# Test with production config
npx expo start --web
```

## Troubleshooting

### Common Issues

1. **Next.js Detection Error:**
   - Remove `pages/` directory and `next.config.js` file
   - Delete `.next/` directory
   - Make sure framework is set to "Create React App" not "Next.js"

2. **ESM Module Resolution Errors:**
   - Use `--legacy-peer-deps` flag in install and build commands
   - Ensure framework is NOT set to "Next.js"

3. **Spotify Authentication Fails:**
   - Verify redirect URI matches exactly in Spotify dashboard
   - Check that environment variables are set correctly
   - Ensure HTTPS is used in production

4. **Build Fails:**
   - Check that all dependencies are in package.json
   - Verify app.config.js syntax
   - Make sure all required environment variables are set

5. **Firebase Analytics Not Working:**
   - Verify all Firebase environment variables are set
   - Check Firebase project settings
   - Ensure domain is authorized in Firebase

### Environment Variable Verification

You can verify environment variables are loaded correctly by checking the browser console for:
```
SPOTIFY_CLIENT_ID: your_client_id
REDIRECT_URI: https://your-vercel-app.vercel.app
```

## Security Notes

- Never commit `.env` files to your repository
- Use different Spotify apps for development and production
- Consider using Vercel's environment variable inheritance for different environments
- Regularly rotate API keys and secrets

## Performance Optimization

- The web build is optimized for production automatically
- Static assets are served via Vercel's CDN
- Consider implementing service worker for offline functionality

## Monitoring

- Monitor deployments in Vercel dashboard
- Check Spotify API usage in developer dashboard
- Monitor Firebase analytics for user engagement 