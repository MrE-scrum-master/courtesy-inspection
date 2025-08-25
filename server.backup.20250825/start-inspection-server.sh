#!/bin/bash

# Courtesy Inspection Server Startup Script
# Starts the server with the full inspection implementation

echo "🚀 Starting Courtesy Inspection Server..."
echo "📍 Port: 8847 (local development)"
echo "🔗 Health check: http://localhost:8847/api/health"
echo ""

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please make sure the .env file exists in the server directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set development environment
export NODE_ENV=development

# Start the server using the JavaScript implementation
echo "🎯 Starting server with full inspection endpoints..."
echo "📋 Using existing JavaScript implementation (server.js)"
echo ""

node server.js