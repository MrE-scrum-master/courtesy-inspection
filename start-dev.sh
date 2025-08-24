#!/bin/bash

# Courtesy Inspection Development Startup Script
# This script starts all services needed for local development

echo "🚀 Starting Courtesy Inspection Development Environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   brew install railwayapp/railway/railway"
    echo "   OR"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if Node 24 is installed
NODE_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt "24" ]; then
    echo "⚠️  Warning: Node.js version is less than 24. Found: $(node --version)"
    echo "   Recommended: Install Node 24 with 'fnm use 24' or 'nvm use 24'"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $SERVER_PID 2>/dev/null
    kill $EXPO_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p server/data/uploads
mkdir -p server/logs

# Check for environment files
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}Creating server/.env from template...${NC}"
    cp server/.env.example server/.env
    echo "⚠️  Please update server/.env with your Railway PostgreSQL credentials"
fi

if [ ! -f "app/.env" ]; then
    echo -e "${YELLOW}Creating app/.env from template...${NC}"
    cp app/.env.example app/.env
fi

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo -e "${BLUE}Installing server dependencies...${NC}"
    cd server && npm install && cd ..
fi

if [ ! -d "app/node_modules" ]; then
    echo -e "${BLUE}Installing app dependencies...${NC}"
    cd app && npm install && cd ..
fi

# Connect to Railway PostgreSQL (if configured)
if [ -f "server/.env" ] && grep -q "DATABASE_URL" server/.env; then
    echo -e "${GREEN}✓ Railway PostgreSQL configured${NC}"
    
    # Optional: Run migrations
    read -p "Run database migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Running database migrations...${NC}"
        cd server && npm run migrate && cd ..
    fi
else
    echo -e "${YELLOW}⚠️  No DATABASE_URL found. Using Railway CLI to connect...${NC}"
    echo "Run: railway link"
    echo "Then: railway service"
    echo "Select your PostgreSQL service"
fi

# Start the API server
echo -e "${GREEN}Starting API server on port 9547...${NC}"
cd server && PORT=9547 npm run dev &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 3

# Start Expo
echo -e "${GREEN}Starting Expo on port 9545...${NC}"
cd app && npx expo start --port 9545 &
EXPO_PID=$!
cd ..

# Display access information
echo -e "\n${GREEN}🎉 Development environment is ready!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Access your services at:${NC}"
echo -e "  📱 Expo Metro: ${BLUE}http://localhost:9545${NC}"
echo -e "  🌐 Web App:    ${BLUE}http://localhost:9546${NC} (or press 'w' in Metro)"
echo -e "  📱 iOS:        Press 'i' in Metro Bundler"
echo -e "  🤖 Android:    Press 'a' in Metro Bundler"
echo -e "  🚀 API:        ${BLUE}http://localhost:9547${NC}"
echo -e "  💾 Health:     ${BLUE}http://localhost:9547/api/health${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "\n${GREEN}Railway CLI Commands:${NC}"
echo -e "  railway logs    - View PostgreSQL logs"
echo -e "  railway connect - Connect to PostgreSQL via psql"
echo -e "  railway run npm run migrate - Run migrations"
echo -e "\n${GREEN}Happy coding! 🚀${NC}\n"

# Keep script running
wait $SERVER_PID $EXPO_PID