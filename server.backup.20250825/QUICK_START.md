# 🚀 Courtesy Inspection - Quick Start Guide

## Immediate Commands

### Start Local Development (Port 8847)
```bash
cd server
npm run dev:local
```

### Test the Server
```bash
# Health check
curl http://localhost:8847/api/health

# Login and get token
curl -X POST http://localhost:8847/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "howtoreachmr.e@gmail.com", "password": "password123"}'

# Test inspections (use token from login response)
export TOKEN="your_jwt_token_here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8847/api/inspections
```

### Deploy to Railway
```bash
./deploy-railway.sh
```

## 📋 What's Working

✅ **Server**: Running on port 8847 (local) / Railway PORT (production)  
✅ **Database**: Railway PostgreSQL with test data  
✅ **Authentication**: JWT tokens working  
✅ **Inspections**: Full CRUD endpoints  
✅ **Voice Processing**: Voice parsing ready  
✅ **File Upload**: Ready for inspection photos  

## 🔑 Test Credentials

- **Admin**: `howtoreachmr.e@gmail.com` / `password123`
- **Mechanic**: `mike@shop.com` / `password123`
- **Manager**: `sarah@shop.com` / `password123`

## 📈 Key URLs (Local)

- **Health**: http://localhost:8847/api/health
- **Login**: POST http://localhost:8847/api/auth/login
- **Inspections**: GET http://localhost:8847/api/inspections
- **Voice**: POST http://localhost:8847/api/voice/parse
- **Upload**: POST http://localhost:8847/api/upload

## 🛟 Troubleshooting

**Port conflict?** → Change PORT in `.env` file  
**Database issues?** → Check `railway run psql`  
**Authentication fails?** → Verify test user exists in database  
**CORS errors?** → Check `allowedOrigins` in `server.js`

## 📚 Documentation

- `DEPLOYMENT_SUMMARY.md` - Complete deployment details
- `railway-env.txt` - Production environment variables
- `start-inspection-server.sh` - Alternative startup script

**Ready to build! 🎯**