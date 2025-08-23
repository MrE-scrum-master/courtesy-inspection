#!/bin/bash

# Courtesy Inspection App - Development Startup Script

echo "🚀 Starting Courtesy Inspection App..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Type check
echo "🔍 Type checking..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ Type checking failed. Please fix the errors above."
    exit 1
fi
echo "✅ Type checking passed!"
echo ""

# Start the development server
echo "🎯 Starting Expo development server..."
echo ""
echo "Available platforms:"
echo "  - Press 'i' for iOS Simulator"
echo "  - Press 'a' for Android Emulator"
echo "  - Press 'w' for Web browser"
echo "  - Press 'r' to reload"
echo "  - Press 'c' to clear cache"
echo ""

npm start