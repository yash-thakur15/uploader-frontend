# Frontend Deployment Guide

This guide covers deploying the React frontend to various hosting platforms.

## 🚀 Deployment Platforms

### 1. Netlify

#### Prerequisites

- GitHub/GitLab repository
- Netlify account

#### Steps

1. Connect your repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Set environment variables:
   - `VITE_API_BASE_URL=https://your-backend-domain.com`
4. Deploy

#### Netlify CLI (Alternative)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the project
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### 2. Vercel

#### Steps

1. Connect your repository to Vercel
2. Configure build settings (auto-detected for Vite)
3. Set environment variables:
   - `VITE_API_BASE_URL=https://your-backend-domain.com`
4. Deploy

#### Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 3. GitHub Pages

#### Steps

1. Install gh-pages package:

```bash
npm install --save-dev gh-pages
```

2. Add to package.json:

```json
{
  "homepage": "https://yourusername.github.io/repository-name",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. Update vite.config.js:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/repository-name/", // Replace with your repo name
});
```

4. Deploy:

```bash
npm run deploy
```

### 4. Firebase Hosting

#### Steps

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting

# Build the project
npm run build

# Deploy
firebase deploy
```

Firebase configuration (firebase.json):

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 5. AWS S3 + CloudFront

#### Steps

```bash
# Build the project
npm run build

# Install AWS CLI
# Upload to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache (if using CloudFront)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### 6. DigitalOcean App Platform

#### Steps

1. Connect your repository to DigitalOcean
2. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Set environment variables
4. Deploy

## 🔧 Environment Configuration

### Development (.env.local)

```env
VITE_API_BASE_URL=http://localhost:3001
```

### Production (.env.production)

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

### Platform-Specific Environment Variables

#### Netlify

Set in Netlify dashboard under Site settings > Environment variables

#### Vercel

Set in Vercel dashboard under Project Settings > Environment Variables

#### GitHub Pages

GitHub Pages doesn't support server-side environment variables. You'll need to:

1. Create different build scripts for different environments
2. Or use a build-time configuration file

## 🔒 Security Considerations

### HTTPS

- Always use HTTPS in production
- Ensure your backend URL uses HTTPS
- Most modern hosting platforms provide HTTPS by default

### Environment Variables

- Never commit `.env` files with sensitive data
- Use platform-specific environment variable settings
- Prefix all environment variables with `VITE_` for Vite to include them in the build

### CORS

- Ensure your backend's `ALLOWED_ORIGINS` includes your frontend domain
- Test CORS after deployment

## 📊 Build Optimization

### Vite Configuration (vite.config.js)

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false, // Disable in production for security
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
```

### Performance Optimizations

- Enable gzip compression on your hosting platform
- Use CDN for static assets
- Implement code splitting
- Optimize images and assets

## 🚨 Troubleshooting

### Common Issues

1. **API Connection Errors**

   - Check `VITE_API_BASE_URL` is correct
   - Verify backend is accessible from frontend domain
   - Check CORS configuration on backend

2. **Build Failures**

   - Ensure all dependencies are in package.json
   - Check Node.js version compatibility
   - Verify build command is correct

3. **Routing Issues (SPA)**

   - Configure your hosting platform for SPA routing
   - Add redirects/rewrites for client-side routing

4. **Environment Variables Not Working**
   - Ensure variables are prefixed with `VITE_`
   - Check platform-specific environment variable settings
   - Rebuild after changing environment variables

### Platform-Specific Fixes

#### Netlify SPA Routing

Create `public/_redirects` file:

```
/*    /index.html   200
```

#### Vercel SPA Routing

Create `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

#### Apache SPA Routing

Create `public/.htaccess`:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

## 📝 Post-Deployment Checklist

After deployment:

- [ ] Test the application loads correctly
- [ ] Verify API connection to backend
- [ ] Test file upload functionality end-to-end
- [ ] Check browser console for errors
- [ ] Test on different devices/browsers
- [ ] Verify HTTPS is working
- [ ] Test all routes (if using client-side routing)

## 🔄 Continuous Deployment

### GitHub Actions (Example)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: "./dist"
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🌐 Custom Domain

### Netlify

1. Go to Domain settings in Netlify dashboard
2. Add custom domain
3. Configure DNS records as instructed

### Vercel

1. Go to Project Settings > Domains
2. Add custom domain
3. Configure DNS records

### CloudFlare (Recommended for additional security)

1. Add your domain to CloudFlare
2. Configure DNS to point to your hosting platform
3. Enable security features (SSL, DDoS protection, etc.)

## 📈 Monitoring

### Analytics

- Google Analytics
- Vercel Analytics
- Netlify Analytics

### Error Monitoring

- Sentry
- LogRocket
- Bugsnag

### Performance Monitoring

- Lighthouse CI
- Web Vitals
- GTMetrix

Remember to test your deployment thoroughly and monitor for any issues after going live!
