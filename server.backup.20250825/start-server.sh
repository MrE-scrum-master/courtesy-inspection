#!/bin/bash

# Courtesy Inspection Server Startup Script
# Initializes dependencies and starts the server

echo "🚀 Starting Courtesy Inspection Server Setup..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the server directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found!${NC}"
    echo "Please run this script from the server directory."
    exit 1
fi

# Check if .env exists, if not create from parent .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    if [ -f ".env" ]; then
        echo -e "${GREEN}✓ .env already exists${NC}"
    else
        echo -e "${BLUE}Using existing Railway configuration...${NC}"
        # .env already exists with Railway credentials
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p data/uploads
mkdir -p logs
mkdir -p scripts

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:bLUXyBJMOXRbHEmABostVMrBCsxPoatu@nozomi.proxy.rlwy.net:14824/railway'
});
client.connect()
  .then(() => {
    console.log('✓ Database connection successful');
    client.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database connection failed. Please check your credentials.${NC}"
    exit 1
fi

# Start the server
echo -e "\n${GREEN}🎉 Starting Courtesy Inspection Server...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Once started, test these endpoints:${NC}"
echo -e "  • Health Check: ${BLUE}curl http://localhost:3000/api/health${NC}"
echo -e "  • DB Test: ${BLUE}curl http://localhost:3000/api/db/test${NC}"
echo -e "  • Voice Test: ${BLUE}curl -X POST http://localhost:3000/api/voice/parse -H 'Content-Type: application/json' -d '{\"text\":\"front brakes at 5 millimeters\"}'${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Start the server
npm start