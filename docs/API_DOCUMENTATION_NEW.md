# Courtesy Inspection API Documentation
*Version 1.0 | Railway PostgreSQL Backend*

## Base URL
- **Production**: `https://api.courtesyinspection.com`
- **Development**: `http://localhost:3000`

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "phone": "555-0100",
  "role": "mechanic",
  "shop_id": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "mechanic"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### POST /api/auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "mechanic",
      "shop_id": "uuid"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### POST /api/auth/refresh
Refresh expired JWT token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

### GET /api/auth/profile 🔒
Get current authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "phone": "555-0100",
      "role": "mechanic",
      "shop": {
        "id": "uuid",
        "name": "Test Auto Shop",
        "address": "123 Main St"
      }
    }
  }
}
```

---

## 🔧 Inspection Endpoints

### POST /api/inspections 🔒
Create a new inspection.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "customer_id": "uuid",
  "type": "courtesy",
  "status": "in_progress",
  "notes": "Customer mentioned brake noise"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "inspection": {
      "id": "uuid",
      "inspection_number": "INS-2025-0001",
      "vehicle_id": "uuid",
      "customer_id": "uuid",
      "shop_id": "uuid",
      "created_by": "uuid",
      "type": "courtesy",
      "status": "in_progress",
      "created_at": "2025-01-24T10:00:00Z"
    }
  }
}
```

### GET /api/inspections 🔒
List all inspections for the user's shop.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): Filter by status (in_progress, completed, approved)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "inspections": [
      {
        "id": "uuid",
        "inspection_number": "INS-2025-0001",
        "vehicle": {
          "make": "Honda",
          "model": "Civic",
          "year": 2020,
          "vin": "1HGCV1F31LA123456"
        },
        "customer": {
          "full_name": "John Doe",
          "phone": "555-0100"
        },
        "status": "in_progress",
        "created_at": "2025-01-24T10:00:00Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

### GET /api/inspections/:id 🔒
Get detailed inspection by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "inspection": {
      "id": "uuid",
      "inspection_number": "INS-2025-0001",
      "vehicle": { /* vehicle details */ },
      "customer": { /* customer details */ },
      "items": [
        {
          "id": "uuid",
          "category": "brakes",
          "component": "Front Brake Pads",
          "status": "yellow",
          "measurement": "5mm",
          "notes": "Will need replacement soon",
          "photos": []
        }
      ],
      "status": "in_progress",
      "created_at": "2025-01-24T10:00:00Z"
    }
  }
}
```

### GET /api/inspections/shop/:shopId 🔒
Get all inspections for a specific shop.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK` (Same format as GET /api/inspections)

### PUT /api/inspections/:id 🔒
Update inspection details.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "completed",
  "notes": "Inspection complete, recommendations made",
  "completed_at": "2025-01-24T11:00:00Z"
}
```

### PATCH /api/inspections/:id/items 🔒
Update inspection items/findings.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "items": [
    {
      "category": "brakes",
      "component": "Front Brake Pads",
      "status": "yellow",
      "measurement": "5mm",
      "notes": "Will need replacement within 3 months"
    }
  ]
}
```

---

## 🚗 Vehicle Endpoints

### GET /api/vehicles/vin/:vin 🔒
Decode VIN and get vehicle information from NHTSA.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "vin": "1HGCV1F31LA123456",
    "year": 2020,
    "make": "Honda",
    "model": "Civic",
    "trim": "LX",
    "engine": "2.0L 4-Cylinder",
    "transmission": "CVT",
    "drive_type": "FWD",
    "body_type": "Sedan",
    "doors": 4,
    "metadata": { /* additional NHTSA data */ }
  }
}
```

### POST /api/vehicles 🔒
Create a new vehicle record.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "vin": "1HGCV1F31LA123456",
  "customer_id": "uuid",
  "year": 2020,
  "make": "Honda",
  "model": "Civic",
  "license_plate": "ABC123",
  "color": "Blue"
}
```

### GET /api/vehicles/:id 🔒
Get vehicle details by ID.

### PATCH /api/vehicles/:id/customer 🔒
Update vehicle's customer assignment.

### GET /api/customers/:customerId/vehicles 🔒
Get all vehicles for a customer.

---

## 👥 Customer Endpoints

### GET /api/customers 🔒
List all customers for the shop.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `search` (optional): Search by name, phone, or email
- `limit` (optional): Number of results (default: 50)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "uuid",
        "full_name": "John Doe",
        "phone": "555-0100",
        "email": "john@example.com",
        "vehicles": [
          {
            "id": "uuid",
            "year": 2020,
            "make": "Honda",
            "model": "Civic"
          }
        ],
        "created_at": "2025-01-24T10:00:00Z"
      }
    ],
    "total": 10
  }
}
```

### POST /api/customers 🔒
Create a new customer.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "full_name": "John Doe",
  "phone": "555-0100",
  "email": "john@example.com",
  "address": "123 Main St"
}
```

### GET /api/customers/search 🔒
Search customers by phone or email.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `phone`: Phone number to search
- `email`: Email to search

---

## 📸 Photo Endpoints

### POST /api/photos/upload 🔒
Upload a photo file.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**
- `photo`: Image file (JPEG, PNG)
- `category`: Photo category (exterior, interior, undercarriage, etc.)

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "photo": {
      "id": "uuid",
      "filename": "photo_123456.jpg",
      "url": "/uploads/photos/photo_123456.jpg",
      "size": 245678,
      "mime_type": "image/jpeg"
    }
  }
}
```

### GET /api/photos/:id 🔒
Get photo metadata and URL.

### POST /api/inspections/:id/photos 🔒
Attach photo to inspection.

### DELETE /api/photos/:id 🔒
Soft delete a photo.

---

## 💬 SMS Endpoints

### POST /api/sms/send-mock 🔒
Send mock SMS (for testing without Telnyx).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "to": "+15555550100",
  "template": "inspection_ready",
  "inspection_id": "uuid"
}
```

### GET /api/sms/history 🔒
Get SMS conversation history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `phone`: Filter by phone number
- `inspection_id`: Filter by inspection

### POST /api/sms/preview
Preview SMS template (no auth required).

**Request Body:**
```json
{
  "template": "inspection_complete",
  "data": {
    "customer_name": "John",
    "vehicle": "2020 Honda Civic",
    "link": "https://ci.link/abc123"
  }
}
```

---

## 🌐 Portal Endpoints

### GET /api/portal/:token
Get public inspection view (no auth required).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "inspection": {
      /* Public inspection data */
    },
    "customer": {
      /* Basic customer info */
    },
    "shop": {
      /* Shop contact info */
    }
  }
}
```

### POST /api/portal/generate 🔒
Generate portal link for inspection.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "inspection_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "abc123xyz",
    "url": "https://app.courtesyinspection.com/portal/abc123xyz",
    "short_url": "https://ci.link/abc123"
  }
}
```

---

## 🎤 Voice Endpoints

### POST /api/voice/parse
Parse voice transcription into structured data.

**Request Body:**
```json
{
  "text": "front brake pads at 5 millimeters"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "parsed": {
      "component": "front brake pads",
      "measurement": "5mm",
      "status": "yellow",
      "confidence": 0.95
    }
  }
}
```

---

## 🏥 System Endpoints

### GET /api/health
Health check endpoint (no auth required).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "database": "connected",
    "uptime": 86400,
    "timestamp": "2025-01-24T10:00:00Z"
  }
}
```

---

## Error Responses

All endpoints follow consistent error response format:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Please try again later"
}
```

---

## Rate Limiting

API endpoints are rate limited:
- **Default**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP
- **File uploads**: 10 requests per hour per user

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

---

## File Upload Limits

- **Maximum file size**: 10MB
- **Accepted formats**: JPEG, PNG, WebP
- **Storage**: Railway volumes at `/uploads/photos/`
- **Automatic optimization**: Images resized if > 2048px
- **Retention**: 90 days for unattached photos

---

## Testing

### Test Credentials
```
Email: admin@shop.com
Password: password123
Role: Shop Manager

Email: mike@shop.com
Password: password123
Role: Mechanic

Email: sarah@shop.com
Password: password123
Role: Shop Manager
```

### Test Environment
- Base URL: `http://localhost:3000`
- Database: Railway PostgreSQL (test data seeded)
- SMS: Mock mode (no actual sending)

---

## SDK Examples

### JavaScript/TypeScript
```javascript
// Login
const response = await fetch('https://api.courtesyinspection.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { data } = await response.json();
const token = data.token;

// Make authenticated request
const inspections = await fetch('https://api.courtesyinspection.com/api/inspections', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### cURL
```bash
# Login
curl -X POST https://api.courtesyinspection.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shop.com","password":"password123"}'

# Get inspections
curl https://api.courtesyinspection.com/api/inspections \
  -H "Authorization: Bearer <token>"
```

---

## Changelog

### Version 1.0 (January 2025)
- Initial API release
- Railway PostgreSQL backend
- JWT authentication
- Core inspection CRUD operations
- VIN decoder integration
- Photo upload support
- SMS template system
- Customer portal generation