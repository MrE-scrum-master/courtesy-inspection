#!/bin/bash
# Quick Deployment Script - Expo + Express to Railway
# This script builds the web app and prepares for deployment

set -e  # Exit on any error

echo "🚀 Starting Expo + Express Deployment Process..."

# Check if we're in the right directory
if [ ! -f "CLAUDE.md" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Step 1: Build Expo web app
echo "📦 Building Expo web app..."
cd app

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing app dependencies..."
    npm install
fi

# Ensure required runtime is installed
echo "🔧 Ensuring web runtime is available..."
npx expo install @expo/metro-runtime

# Build the web app
echo "🏗️ Building web app for production..."
npm run build:web

# Step 2: Verify build output
echo "✅ Verifying build output..."
cd ../server
if [ ! -f "public/index.html" ]; then
    echo "❌ Error: Build failed - index.html not found"
    exit 1
fi

# Step 3: Test server locally (optional)
echo "🧪 Testing server integration..."
echo "Starting server on http://localhost:3000..."
echo "Press Ctrl+C when ready to continue with deployment"

# Install server dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing server dependencies..."
    npm install
fi

# Start server for testing
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Test API endpoint
echo "🔍 Testing API endpoint..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ API endpoint working"
else
    echo "⚠️ API endpoint test failed"
fi

# Test web app
echo "🔍 Testing web app..."
if curl -s http://localhost:3000/ | grep -q "Courtesy Inspection"; then
    echo "✅ Web app serving correctly"
else
    echo "⚠️ Web app test failed"
fi

# Kill the test server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "📁 Files ready for deployment:"
echo "   - server/public/index.html (web app entry point)"
echo "   - server/public/_expo/ (app bundle and assets)"
echo "   - server/server.js (Express server with static middleware)"
echo ""
echo "🚀 To deploy to Railway:"
echo "   1. git add ."
echo "   2. git commit -m 'Deploy Expo web + Express integration'"
echo "   3. git push railway main"
echo ""
echo "📖 For more details, see DEPLOYMENT_GUIDE.md"