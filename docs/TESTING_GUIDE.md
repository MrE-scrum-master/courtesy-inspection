# Courtesy Inspection - Testing Guide
*Version 1.0 | Current Implementation*

## Overview

This guide covers testing strategies, tools, and procedures for the Courtesy Inspection MVP running on Railway PostgreSQL.

---

## 🧪 Testing Environment Setup

### Prerequisites
```bash
# Install dependencies
cd server
npm install --save-dev jest supertest @jest/globals

cd ../app
npm install --save-dev @testing-library/react-native jest-expo

# Environment variables for testing
cp .env.example .env.test
```

### Test Database Configuration
```env
# .env.test
DATABASE_URL=postgresql://postgres:password@localhost:5432/courtesy_test
JWT_SECRET=test-secret-key-do-not-use-in-production
NODE_ENV=test
```

### Initialize Test Database
```bash
# Create test database
railway run psql -c "CREATE DATABASE courtesy_test;"

# Run migrations on test database
NODE_ENV=test railway run npm run migrate

# Seed test data
NODE_ENV=test railway run npm run seed
```

---

## 🔧 Unit Testing

### Backend Unit Tests

#### Authentication Service Tests
```javascript
// server/tests/auth.test.js
const AuthService = require('../auth');
const Database = require('../db');

describe('AuthService', () => {
  let auth;
  let db;

  beforeAll(() => {
    db = new Database();
    auth = new AuthService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  test('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hash = await auth.hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  test('should verify password correctly', async () => {
    const password = 'testPassword123';
    const hash = await auth.hashPassword(password);
    const isValid = await auth.verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  test('should generate valid JWT token', () => {
    const user = { id: 1, email: 'test@example.com', role: 'mechanic' };
    const token = auth.generateToken(user);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });
});
```

#### Voice Parser Tests
```javascript
// server/tests/voice-parser.test.js
const VoiceParser = require('../voice-parser');

describe('VoiceParser', () => {
  const parser = new VoiceParser();

  test('should parse brake measurements', () => {
    const result = parser.parse('front brakes at 5 millimeters');
    expect(result.component).toBe('front brake pads');
    expect(result.measurement).toBe('5mm');
    expect(result.status).toBe('yellow');
  });

  test('should parse tire measurements', () => {
    const result = parser.parse('left front tire 3/32');
    expect(result.component).toBe('left front tire');
    expect(result.measurement).toBe('3/32"');
    expect(result.status).toBe('red');
  });
});
```

### Frontend Unit Tests

#### Component Tests
```javascript
// app/tests/components/PhotoCapture.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoCapture } from '../src/components/PhotoCapture';

describe('PhotoCapture Component', () => {
  test('should render capture button', () => {
    const { getByText } = render(
      <PhotoCapture onPhotoCapture={jest.fn()} />
    );
    expect(getByText('Take Photo')).toBeTruthy();
  });

  test('should call onPhotoCapture when photo taken', () => {
    const mockCapture = jest.fn();
    const { getByText } = render(
      <PhotoCapture onPhotoCapture={mockCapture} />
    );
    
    fireEvent.press(getByText('Take Photo'));
    // Mock camera interaction
    expect(mockCapture).toHaveBeenCalled();
  });
});
```

---

## 🔄 Integration Testing

### API Integration Tests
```javascript
// server/tests/api.test.js
const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {
  let token;
  let server;

  beforeAll(async () => {
    server = app.listen(3001);
    
    // Login to get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@shop.com',
        password: 'password123'
      });
    
    token = response.body.data.token;
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Inspection Endpoints', () => {
    test('should create inspection', async () => {
      const response = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicle_id: 'test-vehicle-id',
          customer_id: 'test-customer-id',
          type: 'courtesy'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.inspection).toBeDefined();
    });

    test('should list inspections', async () => {
      const response = await request(app)
        .get('/api/inspections')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.inspections)).toBe(true);
    });
  });
});
```

### Database Integration Tests
```javascript
// server/tests/db.test.js
const Database = require('../db');

describe('Database Integration', () => {
  let db;

  beforeAll(() => {
    db = new Database();
  });

  afterAll(async () => {
    await db.close();
  });

  test('should connect to database', async () => {
    const result = await db.query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);
  });

  test('should handle transactions', async () => {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'INSERT INTO customers (full_name, phone, shop_id) VALUES ($1, $2, $3) RETURNING *',
        ['Test Customer', '555-0199', 'test-shop-id']
      );
      
      expect(result.rows[0].full_name).toBe('Test Customer');
      
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
```

---

## 🌐 End-to-End Testing

### Mobile App E2E Tests (Detox)
```javascript
// app/e2e/inspection-flow.e2e.js
describe('Inspection Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete inspection workflow', async () => {
    // Login
    await element(by.id('email-input')).typeText('mike@shop.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    // Navigate to inspections
    await expect(element(by.id('dashboard'))).toBeVisible();
    await element(by.id('new-inspection-button')).tap();
    
    // Create inspection
    await element(by.id('vin-input')).typeText('1HGCV1F31LA123456');
    await element(by.id('decode-vin-button')).tap();
    
    // Wait for VIN decode
    await waitFor(element(by.id('vehicle-info')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Continue with inspection
    await element(by.id('start-inspection-button')).tap();
    
    // Add inspection item
    await element(by.id('add-item-button')).tap();
    await element(by.id('component-select')).tap();
    await element(by.text('Front Brake Pads')).tap();
    await element(by.id('status-yellow')).tap();
    await element(by.id('measurement-input')).typeText('5mm');
    await element(by.id('save-item-button')).tap();
    
    // Complete inspection
    await element(by.id('complete-inspection-button')).tap();
    await expect(element(by.text('Inspection Complete'))).toBeVisible();
  });
});
```

### Web E2E Tests (Playwright)
```javascript
// tests/e2e/web-portal.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Customer Portal', () => {
  test('should display inspection report', async ({ page }) => {
    // Navigate to portal
    await page.goto('http://localhost:3000/portal/test-token');
    
    // Check content loads
    await expect(page.locator('h1')).toContainText('Inspection Report');
    await expect(page.locator('.vehicle-info')).toBeVisible();
    await expect(page.locator('.inspection-items')).toBeVisible();
    
    // Check responsive design
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await expect(page.locator('.mobile-menu')).toBeVisible();
  });
});
```

---

## 🔍 Manual Testing Checklist

### Critical Path Testing

#### 1. Authentication Flow
- [ ] Login with valid credentials
- [ ] Login with invalid credentials shows error
- [ ] Token refresh works after expiry
- [ ] Logout clears session
- [ ] Protected routes redirect to login

#### 2. Inspection Creation
- [ ] VIN scanner decodes correctly
- [ ] Manual vehicle entry works
- [ ] Customer selection/creation works
- [ ] Inspection saves to database
- [ ] Inspection appears in list

#### 3. Inspection Items
- [ ] Add brake measurements
- [ ] Add tire measurements
- [ ] Add fluid checks
- [ ] Upload photos
- [ ] Voice notes record and save

#### 4. SMS Communication
- [ ] Preview SMS templates
- [ ] Send test SMS (mock)
- [ ] View SMS history
- [ ] Customer portal link generates

#### 5. Photo Upload
- [ ] Camera capture works
- [ ] Photo uploads to Railway volume
- [ ] Photo displays in inspection
- [ ] Photo delete works

### Device Testing Matrix

| Feature | iPhone 14 | iPhone SE | iPad Pro | Android | Web |
|---------|-----------|-----------|----------|---------|-----|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |
| VIN Scanner | ✅ | ✅ | ✅ | ✅ | N/A |
| Photo Capture | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Voice Notes | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| SMS View | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Performance Testing

### API Load Testing (Artillery)
```yaml
# load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
  
scenarios:
  - name: "Inspection Flow"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "admin@shop.com"
            password: "password123"
          capture:
            - json: "$.data.token"
              as: "token"
      
      - get:
          url: "/api/inspections"
          headers:
            Authorization: "Bearer {{ token }}"
      
      - post:
          url: "/api/inspections"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            vehicle_id: "test-id"
            customer_id: "test-id"
```

Run with:
```bash
npm install -g artillery
artillery run load-test.yml
```

### Database Performance
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

---

## 🐛 Debugging Tools

### Backend Debugging
```bash
# Enable debug logging
DEBUG=* npm start

# Database query logging
DATABASE_LOGGING=true npm start

# Memory profiling
node --inspect server.js
# Open chrome://inspect
```

### Frontend Debugging
```bash
# React Native Debugger
npx react-native log-ios
npx react-native log-android

# Expo debugging
expo start --clear
# Press 'd' for developer menu

# Network inspection
npx react-native-debugger
```

### Railway Logs
```bash
# View real-time logs
railway logs -f

# Filter by error level
railway logs --filter=error

# Export logs
railway logs > logs.txt
```

---

## 📊 Test Coverage Goals

### Current Coverage
- **Backend**: ~40% (server/tests/)
- **Frontend**: ~20% (app/tests/)
- **E2E**: ~10% (manual testing)

### Target Coverage (MVP)
- **Backend**: 70%
- **Frontend**: 50%
- **E2E**: 30%

### Priority Areas
1. **Authentication**: 90% coverage required
2. **Inspection CRUD**: 80% coverage required
3. **VIN Decoder**: 70% coverage required
4. **Photo Upload**: 60% coverage required
5. **SMS**: 50% coverage (mock testing)

---

## 🔄 CI/CD Testing Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd server && npm ci
          cd ../app && npm ci
      
      - name: Run backend tests
        run: cd server && npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Run frontend tests
        run: cd app && npm test
```

---

## 📝 Test Documentation

### Writing Test Cases
```markdown
## Test Case: VIN-001
**Feature**: VIN Scanner
**Scenario**: Valid VIN decode
**Steps**:
1. Navigate to Create Inspection
2. Enter VIN: 1HGCV1F31LA123456
3. Tap Decode button

**Expected Result**:
- Vehicle info displays
- Make: Honda
- Model: Civic
- Year: 2020

**Actual Result**: [To be filled during testing]
**Status**: [Pass/Fail]
**Notes**: [Any observations]
```

### Bug Reporting Template
```markdown
## Bug Report: BUG-001
**Date**: 2025-01-24
**Reporter**: [Name]
**Severity**: High/Medium/Low

**Description**:
Brief description of the issue

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Environment**:
- Device: iPhone 14
- OS: iOS 17.2
- App Version: 1.0.0
- Server: Production/Staging/Local

**Screenshots/Logs**:
[Attach if available]
```

---

## 🎯 Testing Best Practices

1. **Test Early, Test Often**: Run tests before every commit
2. **Test in Production-Like Environment**: Use Railway staging
3. **Real Device Testing**: Don't rely only on simulators
4. **Test Data Management**: Keep test data separate and clean
5. **Error Scenario Testing**: Test error paths, not just happy paths
6. **Performance Baseline**: Establish and monitor performance metrics
7. **Security Testing**: Include authentication and authorization tests
8. **Accessibility Testing**: Ensure app is usable by all users

---

## Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test auth.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:perf
```

This testing guide provides comprehensive coverage for the current MVP implementation. Focus on critical path testing first, then expand coverage as the application stabilizes.