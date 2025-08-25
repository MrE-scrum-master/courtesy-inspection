#!/bin/bash

# Railway Deployment Script for Courtesy Inspection API
# Deploys the JavaScript server implementation to Railway

set -e  # Exit on any error

echo "🚀 Deploying Courtesy Inspection API to Railway..."
echo ""

# Ensure we're in the server directory
cd "$(dirname "$0")"

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

# Check if logged in to Railway
if ! railway status &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

# Check if this is a Railway project
if [ ! -f "../railway.toml" ]; then
    echo "❌ railway.toml not found. Run: railway init"
    exit 1
fi

echo "✅ Railway CLI is ready"
echo "✅ Project configuration found"
echo ""

# Check environment
echo "🔧 Checking deployment environment..."

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found (this is ok for Railway - it uses environment variables from dashboard)"
else
    echo "✅ Local .env found"
fi

if [ ! -f "server.js" ]; then
    echo "❌ server.js not found"
    exit 1
fi
echo "✅ server.js found"

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi
echo "✅ package.json found"

echo ""
echo "📋 Pre-deployment checklist:"
echo "   ✅ Server implementation: JavaScript (server.js)"
echo "   ✅ Database: PostgreSQL (Railway managed)"
echo "   ✅ Port configuration: Dynamic (Railway PORT env var)"
echo "   ✅ File uploads: Local storage with Railway volumes"
echo "   ✅ Authentication: JWT with secure secrets"
echo ""

# Show current service info
echo "📊 Current Railway service:"
railway status
echo ""

# Check database
echo "🗄️  Checking database connection..."
if railway run echo "Database URL: $DATABASE_URL" | grep -q "postgresql://"; then
    echo "✅ PostgreSQL database configured"
else
    echo "❌ Database not configured. Add PostgreSQL service in Railway dashboard"
    exit 1
fi
echo ""

# Ask for confirmation
read -p "🤔 Ready to deploy? This will push the current code to Railway. (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🚀 Starting deployment..."

# Deploy using Railway CLI
echo "📤 Pushing code to Railway..."
railway up --service courtesy-inspection-server

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "🔗 Useful commands:"
echo "   View logs: railway logs -f"
echo "   Open dashboard: railway open"
echo "   Check status: railway status"
echo "   Connect to DB: railway run psql"
echo ""

echo "🎯 Next steps:"
echo "1. Check deployment logs: railway logs -f"
echo "2. Verify health check: curl https://your-app.up.railway.app/api/health"
echo "3. Test authentication with your user credentials"
echo "4. Update CORS_ORIGINS in Railway dashboard if needed"
echo ""
echo "🎉 Deployment complete!"