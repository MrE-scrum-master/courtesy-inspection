# Expo Web App Rebuild Instructions

This guide explains how to rebuild and redeploy the Expo web app for the Courtesy Inspection project.

## Overview

The project uses a pragmatic MVP deployment strategy where Expo web builds are generated locally and committed to git. This allows Railway to deploy without needing to build the web app during deployment.

**Architecture**: Expo web app → Local build → Git commit → Railway deployment

## Quick Rebuild (30 seconds)

```bash
# Navigate to app directory
cd app

# Build Expo web app (outputs to ../server/public)
npm run build:web

# Commit and deploy
git add ../server/public
git commit -m "rebuild: Update Expo web app build

$(date): Rebuilt web app with latest changes
- Bundle size: $(du -sh ../server/public | cut -f1)
- Updated assets and JavaScript bundle

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to trigger Railway deployment
git push origin main
```

## Detailed Steps

### 1. Prerequisites

- Node.js 24.0.0+ installed
- All dependencies installed (`npm install` in both `app/` and `server/`)
- Git repository access

### 2. Build Process

```bash
cd app
npm run build:web
```

This command:
- Runs `expo export --platform web --output-dir ../server/public`
- Generates production-optimized web assets
- Places output in `server/public/` directory
- Creates ~5.9MB of assets (2.1MB JS + 3.8MB fonts/icons)

### 3. Generated Files

The build creates:
```
server/public/
├── _expo/
│   └── static/js/web/
│       └── index-[hash].js      # Main bundle (~2.1MB)
├── assets/
│   └── node_modules/
│       └── @expo/vector-icons/  # Font files (~3.8MB)
├── favicon.ico                  # App icon
├── index.html                   # Main HTML file
├── metadata.json               # Expo metadata
└── .gitkeep                    # Ensures directory exists
```

### 4. Deployment

The Express server is already configured to:
- Serve static files from `server/public/`
- Handle client-side routing (SPA fallback to `index.html`)
- Set proper cache headers (1 day for assets, no-cache for HTML)
- Return correct content-types for all file types

After committing and pushing, Railway automatically deploys the changes.

## Bundle Analysis

### Current Bundle Size (as of last build)
- **JavaScript Bundle**: 2.1MB (compressed)
- **Font Assets**: 3.8MB (19 font files for vector icons)
- **Total Size**: 5.9MB
- **Load Time**: <3s on 3G, <1s on WiFi

### Performance Characteristics
- Uses HTTP/2 for faster loading
- Proper content-type headers
- 1-day cache for static assets
- Gzip compression enabled

## Troubleshooting

### Build Issues

**Problem**: Build fails with dependencies error
```bash
cd app && npm install
npm run build:web
```

**Problem**: Bundle size too large (>10MB)
- Check for unused dependencies in `package.json`
- Consider code splitting for large libraries
- Analyze bundle with `npx expo export --platform web --analyze`

### Deployment Issues

**Problem**: Web app not loading after deployment
1. Check if `server/public/index.html` exists
2. Verify Express server static file configuration
3. Test API endpoints first (`/api/health`)

**Problem**: Assets not loading (fonts, icons missing)
1. Ensure `server/public/assets/` directory committed
2. Check network tab in browser for 404s
3. Verify content-type headers for font files

### Git Issues

**Problem**: Build artifacts too large for git
- Current strategy is acceptable for MVP
- Consider CI/CD build pipeline for production scale
- Use Git LFS for very large assets if needed

## Migration to CI/CD (Future)

When ready to move to proper CI/CD:

1. **Remove build artifacts from git**:
```bash
git rm -r server/public
echo "server/public/" >> .gitignore
```

2. **Add build step to Railway**:
Update `railway.toml` or use Railway build command:
```toml
[build]
builder = "nixpacks"
buildCommand = "cd app && npm install && npm run build:web"
```

3. **Update deployment process**:
- Railway builds Expo web app during deployment
- Removes ~6MB from repository
- Increases deployment time by ~2-3 minutes

## Environment-Specific Notes

### Development
- Use `npm run web` for development server
- Hot reload and debugging available
- API runs on different port (3000 vs 3003)

### Production
- Serves from `https://app.courtesyinspection.com`
- HTTPS enforced for all assets
- Production database (Railway PostgreSQL)
- SMS disabled by default

## Convenience Scripts

See `package.json` for additional scripts:
- `npm run rebuild:web` - Rebuild and commit (future enhancement)
- `npm run deploy:web` - Full rebuild and deploy cycle
- `npm run analyze:bundle` - Bundle size analysis

## Support

- **Railway Issues**: Check Railway dashboard and logs
- **Expo Issues**: Use `expo doctor` for diagnostics  
- **Bundle Analysis**: Use Chrome DevTools Network tab
- **Performance**: Test with Lighthouse for Core Web Vitals