# Courtesy Inspection API Documentation

## Overview

The Courtesy Inspection API provides endpoints for managing vehicle inspections, users, customers, and communication. This RESTful API is built with Express.js and PostgreSQL, designed for automotive service shops to digitize their inspection processes.

### Base URL
- **Production**: `https://api.courtesy-inspection.com`
- **Staging**: `https://staging.courtesy-inspection.railway.app`
- **Local Development**: `http://localhost:3000`

### API Version
Current version: `v1`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Getting a Token

**POST** `/api/auth/login`

```json
{
  "email": "mechanic@shop.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "mechanic@shop.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "mechanic",
      "shopId": "shop-uuid"
    }
  }
}
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details",
    "timestamp": "2024-01-15T10:30:00Z",
    "correlationId": "req_abc123"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for the requested action |
| `NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Rate Limiting

API requests are rate limited to prevent abuse:
- **General endpoints**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **File upload endpoints**: 10 requests per 15 minutes per IP

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642248600
```

## Endpoints

### Health Check

#### GET `/api/health`
Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "uptime": 3600,
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  }
}
```

### Authentication

#### POST `/api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:** JWT token and user information

#### POST `/api/auth/logout`
Invalidate current JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST `/api/auth/refresh`
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:** New JWT token

### Users

#### GET `/api/users/profile`
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "mechanic",
    "shopId": "shop-uuid",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT `/api/users/profile`
Update current user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)"
}
```

### Customers

#### GET `/api/customers`
Get list of customers for the current shop.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `search` (string): Search by name, email, or phone
- `sortBy` (string): Sort field (name, email, createdAt)
- `sortOrder` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@example.com",
        "phone": "+1234567890",
        "address": "123 Main St",
        "city": "Anytown",
        "state": "ST",
        "zipCode": "12345",
        "createdAt": "2024-01-01T00:00:00Z",
        "vehicleCount": 2,
        "lastInspectionAt": "2024-01-10T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### POST `/api/customers`
Create a new customer.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required)",
  "phone": "string (required)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "zipCode": "string (optional)"
}
```

#### GET `/api/customers/{id}`
Get customer details by ID.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Customer ID

#### PUT `/api/customers/{id}`
Update customer information.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Customer ID

**Request Body:** Same as POST `/api/customers`

### Inspections

#### GET `/api/inspections`
Get list of inspections.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (draft, in_progress, completed, approved)
- `customerId` (uuid): Filter by customer ID
- `mechanicId` (uuid): Filter by mechanic ID
- `dateFrom` (date): Filter inspections from date (YYYY-MM-DD)
- `dateTo` (date): Filter inspections to date (YYYY-MM-DD)
- `sortBy` (string): Sort field (createdAt, updatedAt, scheduledDate)
- `sortOrder` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "inspections": [
      {
        "id": "uuid",
        "customerId": "uuid",
        "customer": {
          "firstName": "Jane",
          "lastName": "Smith",
          "email": "jane@example.com",
          "phone": "+1234567890"
        },
        "vehicle": {
          "year": 2020,
          "make": "Toyota",
          "model": "Camry",
          "vin": "1HGBH41JXMN109186",
          "licensePlate": "ABC123",
          "mileage": 25000
        },
        "status": "completed",
        "priority": "medium",
        "mechanicId": "uuid",
        "mechanic": {
          "firstName": "John",
          "lastName": "Doe"
        },
        "scheduledDate": "2024-01-15T09:00:00Z",
        "startedAt": "2024-01-15T09:15:00Z",
        "completedAt": "2024-01-15T11:30:00Z",
        "itemsChecked": 45,
        "itemsPassed": 42,
        "itemsFailed": 3,
        "estimatedCost": 450.00,
        "createdAt": "2024-01-14T16:00:00Z",
        "updatedAt": "2024-01-15T11:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "pages": 2
    }
  }
}
```

#### POST `/api/inspections`
Create a new inspection.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "customerId": "uuid (required)",
  "vehicle": {
    "year": "integer (required)",
    "make": "string (required)",
    "model": "string (required)",
    "vin": "string (optional)",
    "licensePlate": "string (optional)",
    "mileage": "integer (optional)"
  },
  "scheduledDate": "datetime (optional)",
  "priority": "string (low|medium|high, default: medium)",
  "notes": "string (optional)"
}
```

#### GET `/api/inspections/{id}`
Get detailed inspection information.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Inspection ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customerId": "uuid",
    "customer": { /* customer details */ },
    "vehicle": { /* vehicle details */ },
    "status": "completed",
    "priority": "medium",
    "mechanicId": "uuid",
    "mechanic": { /* mechanic details */ },
    "scheduledDate": "2024-01-15T09:00:00Z",
    "startedAt": "2024-01-15T09:15:00Z",
    "completedAt": "2024-01-15T11:30:00Z",
    "items": [
      {
        "id": "uuid",
        "category": "brakes",
        "name": "Brake Pads",
        "status": "failed",
        "condition": "worn",
        "notes": "Front brake pads need replacement",
        "voiceNote": "audio_file_url",
        "photos": [
          {
            "id": "uuid",
            "url": "https://storage.com/photo1.jpg",
            "thumbnail": "https://storage.com/photo1_thumb.jpg",
            "caption": "Worn brake pads",
            "takenAt": "2024-01-15T10:15:00Z"
          }
        ],
        "estimatedCost": 150.00,
        "urgency": "high",
        "checkedAt": "2024-01-15T10:15:00Z"
      }
    ],
    "summary": {
      "itemsChecked": 45,
      "itemsPassed": 42,
      "itemsFailed": 3,
      "totalEstimatedCost": 450.00,
      "urgentItems": 1,
      "recommendedItems": 2
    },
    "createdAt": "2024-01-14T16:00:00Z",
    "updatedAt": "2024-01-15T11:30:00Z"
  }
}
```

#### PUT `/api/inspections/{id}`
Update inspection details.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Inspection ID

**Request Body:**
```json
{
  "status": "string (draft|in_progress|completed|approved)",
  "priority": "string (low|medium|high)",
  "scheduledDate": "datetime",
  "notes": "string"
}
```

#### POST `/api/inspections/{id}/start`
Start an inspection (change status to in_progress).

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Inspection ID

#### POST `/api/inspections/{id}/complete`
Complete an inspection (change status to completed).

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Inspection ID

### Inspection Items

#### GET `/api/inspections/{inspectionId}/items`
Get inspection items for a specific inspection.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID

#### POST `/api/inspections/{inspectionId}/items`
Add an item to an inspection.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID

**Request Body:**
```json
{
  "category": "string (required)",
  "name": "string (required)",
  "status": "string (passed|failed|na, default: passed)",
  "condition": "string (excellent|good|fair|poor|worn)",
  "notes": "string (optional)",
  "estimatedCost": "number (optional)",
  "urgency": "string (low|medium|high, default: low)"
}
```

#### PUT `/api/inspections/{inspectionId}/items/{itemId}`
Update an inspection item.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID
- `itemId` (uuid): Item ID

**Request Body:** Same as POST

#### DELETE `/api/inspections/{inspectionId}/items/{itemId}`
Delete an inspection item.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID
- `itemId` (uuid): Item ID

### Photos

#### POST `/api/inspections/{inspectionId}/items/{itemId}/photos`
Upload photos for an inspection item.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID
- `itemId` (uuid): Item ID

**Form Data:**
- `photos`: File[] (max 10 files, 10MB each, jpg/png/heic)
- `captions`: String[] (optional, same length as photos)

**Response:**
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "uuid",
        "url": "https://storage.com/photo1.jpg",
        "thumbnail": "https://storage.com/photo1_thumb.jpg",
        "filename": "brake_pads_worn.jpg",
        "size": 2048576,
        "mimeType": "image/jpeg",
        "caption": "Worn brake pads",
        "takenAt": "2024-01-15T10:15:00Z"
      }
    ]
  }
}
```

#### DELETE `/api/photos/{id}`
Delete a photo.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Photo ID

### Voice Notes

#### POST `/api/inspections/{inspectionId}/items/{itemId}/voice`
Upload voice note for an inspection item.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Path Parameters:**
- `inspectionId` (uuid): Inspection ID
- `itemId` (uuid): Item ID

**Form Data:**
- `audio`: File (max 5MB, mp3/wav/m4a)

**Response:**
```json
{
  "success": true,
  "data": {
    "voiceNote": {
      "id": "uuid",
      "url": "https://storage.com/voice1.mp3",
      "filename": "voice_note_123.mp3",
      "duration": 30.5,
      "size": 512000,
      "transcription": "The brake pads are completely worn down and need immediate replacement",
      "recordedAt": "2024-01-15T10:20:00Z"
    }
  }
}
```

### Reports

#### GET `/api/inspections/{id}/report`
Generate inspection report.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `id` (uuid): Inspection ID

**Query Parameters:**
- `format` (string): Report format (pdf, html, json) - default: json

**Response (JSON format):**
```json
{
  "success": true,
  "data": {
    "report": {
      "inspection": { /* full inspection details */ },
      "summary": {
        "overallStatus": "needs_attention",
        "safetyScore": 85,
        "itemsChecked": 45,
        "itemsPassed": 42,
        "itemsFailed": 3,
        "urgentRepairs": 1,
        "recommendedRepairs": 2,
        "totalEstimatedCost": 450.00
      },
      "categories": [
        {
          "name": "Brakes",
          "status": "failed",
          "items": [ /* category items */ ]
        }
      ],
      "recommendations": [
        {
          "priority": "urgent",
          "item": "Brake Pads",
          "description": "Front brake pads are worn and need immediate replacement",
          "estimatedCost": 150.00
        }
      ],
      "generatedAt": "2024-01-15T11:30:00Z",
      "reportId": "uuid"
    }
  }
}
```

**Response (PDF format):**
Returns PDF file with `Content-Type: application/pdf`

### SMS Communication

#### POST `/api/sms/send`
Send SMS to customer.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "customerId": "uuid (required)",
  "message": "string (required, max 160 chars)",
  "type": "string (notification|reminder|alert, default: notification)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "status": "sent",
    "cost": 0.0075,
    "sentAt": "2024-01-15T12:00:00Z"
  }
}
```

#### GET `/api/sms/history`
Get SMS communication history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `customerId` (uuid): Filter by customer
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20)

### Analytics

#### GET `/api/analytics/dashboard`
Get dashboard analytics data.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period` (string): Time period (day, week, month, year) - default: month

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "dateRange": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-01-31T23:59:59Z"
    },
    "metrics": {
      "totalInspections": 150,
      "completedInspections": 142,
      "averageInspectionTime": 75,
      "customerSatisfaction": 4.8,
      "revenueGenerated": 15750.00,
      "repeatCustomers": 35
    },
    "trends": {
      "inspections": [
        {"date": "2024-01-01", "count": 5},
        {"date": "2024-01-02", "count": 8}
      ],
      "revenue": [
        {"date": "2024-01-01", "amount": 525.00},
        {"date": "2024-01-02", "amount": 840.00}
      ]
    },
    "topCategories": [
      {"category": "brakes", "failureRate": 0.15},
      {"category": "tires", "failureRate": 0.12}
    ]
  }
}
```

## Webhooks

The API supports webhooks for real-time notifications. Configure webhook URLs in your shop settings.

### Webhook Events

| Event | Description |
|-------|-------------|
| `inspection.completed` | Inspection status changed to completed |
| `inspection.approved` | Inspection approved by shop manager |
| `sms.delivered` | SMS message delivered to customer |
| `sms.failed` | SMS message delivery failed |

### Webhook Payload

```json
{
  "event": "inspection.completed",
  "timestamp": "2024-01-15T11:30:00Z",
  "data": {
    "inspection": { /* inspection object */ }
  },
  "shop": {
    "id": "uuid",
    "name": "ABC Auto Shop"
  }
}
```

### Webhook Security

Webhooks are signed with HMAC-SHA256. Verify the signature using the `X-Signature` header:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## SDKs and Libraries

### JavaScript/Node.js

```bash
npm install @courtesy-inspection/api-client
```

```javascript
const { CourtesyInspectionAPI } = require('@courtesy-inspection/api-client');

const api = new CourtesyInspectionAPI({
  baseURL: 'https://api.courtesy-inspection.com',
  apiKey: 'your-jwt-token'
});

// Get inspections
const inspections = await api.inspections.list();

// Create inspection
const newInspection = await api.inspections.create({
  customerId: 'customer-uuid',
  vehicle: {
    year: 2020,
    make: 'Toyota',
    model: 'Camry'
  }
});
```

### Python

```bash
pip install courtesy-inspection-api
```

```python
from courtesy_inspection import CourtesyInspectionAPI

api = CourtesyInspectionAPI(
    base_url='https://api.courtesy-inspection.com',
    api_key='your-jwt-token'
)

# Get inspections
inspections = api.inspections.list()

# Create inspection
new_inspection = api.inspections.create({
    'customerId': 'customer-uuid',
    'vehicle': {
        'year': 2020,
        'make': 'Toyota',
        'model': 'Camry'
    }
})
```

## Testing

### Postman Collection

Download the Postman collection: [Courtesy Inspection API.postman_collection.json](./postman/Courtesy_Inspection_API.postman_collection.json)

### Sample Data

The API includes sample data for testing:
- **Test Shop**: ABC Auto Shop
- **Test Users**: 
  - `admin@shop.com` / `password123` (Shop Manager)
  - `mike@shop.com` / `password123` (Mechanic)
- **Test Customers**: 3 sample customers with contact information

### Rate Limiting in Testing

Test environments have relaxed rate limits:
- **Staging**: 1000 requests per 15 minutes
- **Local**: No rate limiting

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Authentication system
- Inspection management
- Photo and voice note upload
- SMS communication
- Basic analytics

## Support

For API support and questions:
- **Documentation**: https://docs.courtesy-inspection.com
- **Support Email**: api-support@courtesy-inspection.com
- **GitHub Issues**: https://github.com/courtesy-inspection/api/issues
- **Discord**: https://discord.gg/courtesy-inspection