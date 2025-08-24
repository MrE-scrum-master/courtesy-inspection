# Canonical Ports - Courtesy Inspection Project

## 🚀 ALL PORTS IN 9500+ RANGE (No Conflicts!)

| Service | Port | Description |
|---------|------|-------------|
| **Expo Dev** | 9545 | Expo development server (mobile app) |
| **Expo Web** | 9546 | Expo web build (served) |
| **API Server** | 9547 | Express backend API |
| **Metro Bundler** | 9548 | Metro bundler (if needed) |
| **Debugger** | 9549 | React Native debugger (if needed) |

## Environment Variables

```bash
# Server (.env)
PORT=9547

# App (.env)
EXPO_PUBLIC_API_URL=http://localhost:9547
WEB_PORT=9546
```

## Quick Start Commands

```bash
# Start backend API (port 9547)
cd server && PORT=9547 npm run dev

# Start Expo dev (port 9545)
cd app && npx expo start --port 9545

# Start Expo web (port 9546)
cd app && PORT=9546 npm start

# Or all at once with correct ports:
./start-dev.sh
```

## Check/Kill Ports

```bash
# Check ports
lsof -i :9545  # Expo dev
lsof -i :9546  # Web
lsof -i :9547  # API

# Kill if needed
kill -9 $(lsof -t -i:9545)
kill -9 $(lsof -t -i:9546)
kill -9 $(lsof -t -i:9547)
```