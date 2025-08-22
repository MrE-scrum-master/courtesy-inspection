# TESTING STRATEGY - MVP VERSION

**Focus**: "Ship fast, test critical paths manually"

**Version MVP 1.0 | December 2024**

---

## Executive Summary

This MVP testing strategy prioritizes manual testing with basic automation to ship quickly while ensuring critical functionality works. The strategy focuses on essential user workflows and basic quality assurance that can be executed by one person in a day.

**Key MVP Testing Principles:**
- **Manual First**: Prioritize manual testing for speed of implementation
- **Critical Path Focus**: Test only the most important user workflows
- **Simple Tools**: Use basic, quick-to-implement testing tools
- **One-Day Testing**: Complete testing cycle executable by one person in 8 hours

## MVP Testing Principles

- **Manual First**: Critical paths validated through manual testing
- **Basic Coverage**: 30% automated test coverage targeting core functionality
- **Simple Tools**: Standard Jest/React Testing Library without complex infrastructure
- **Fast Feedback**: Quick test execution enabling rapid development cycles
- **Essential Only**: Test core features that prevent major failures

## 1. Test Types & Coverage

### 1.1 Manual Testing (Primary)

**Core User Flows**:
- User registration and login
- Inspection creation and completion
- SMS sending and receiving
- Report generation and sharing
- Basic shop management

**Test Execution**:
- Weekly regression testing
- Feature acceptance testing before releases
- Cross-browser testing on Chrome, Safari, Firefox
- Mobile testing on iOS and Android

### 1.2 Unit Tests (30% Coverage)

**Priority Areas**:
```javascript
// Essential utility functions
describe('Authentication Utils', () => {
  test('validateEmail returns true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
  
  test('generateToken creates valid JWT', () => {
    const token = generateToken({ userId: '123' });
    expect(token).toBeDefined();
    expect(jwt.verify(token, JWT_SECRET)).toBeTruthy();
  });
});

// Critical business logic
describe('Inspection Service', () => {
  test('creates inspection with required fields', () => {
    const inspection = createInspection({
      customerId: '123',
      vehicleYear: 2020,
      vehicleMake: 'Toyota'
    });
    expect(inspection.id).toBeDefined();
    expect(inspection.status).toBe('DRAFT');
  });
});

// Data validation
describe('Input Validation', () => {
  test('phone number validation', () => {
    expect(validatePhoneNumber('+1234567890')).toBe(true);
    expect(validatePhoneNumber('invalid')).toBe(false);
  });
});
```

### 1.3 Integration Tests (Minimal)

**Database Operations**:
```javascript
describe('Database Integration', () => {
  test('creates and retrieves customer', async () => {
    const customer = await createCustomer({
      email: 'test@example.com',
      phone: '+1234567890'
    });
    
    const retrieved = await getCustomerById(customer.id);
    expect(retrieved.email).toBe('test@example.com');
  });
});

// API endpoint testing
describe('API Endpoints', () => {
  test('POST /api/customers creates customer', async () => {
    const response = await request(app)
      .post('/api/customers')
      .send({
        email: 'test@example.com',
        phone: '+1234567890'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});
```

## 2. Testing Tools & Setup

### 2.1 Backend Testing Stack

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

**Jest Configuration** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.(ts|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30
    }
  }
};
```

### 2.2 Frontend Testing Stack

```json
{
  "devDependencies": {
    "@testing-library/react": "^13.0.0",
    "@testing-library/jest-dom": "^5.16.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0"
  }
}
```

**Basic Component Tests**:
```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';

describe('LoginForm', () => {
  test('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
  
  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    
    render(<LoginForm onSubmit={mockOnSubmit} />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

### 2.3 Mobile Testing (React Native)

```javascript
import { render, fireEvent } from '@testing-library/react-native';
import InspectionForm from '../InspectionForm';

describe('InspectionForm', () => {
  test('creates inspection on form submission', () => {
    const mockOnSubmit = jest.fn();
    const { getByTestId } = render(
      <InspectionForm onSubmit={mockOnSubmit} />
    );
    
    fireEvent.changeText(getByTestId('vehicle-year'), '2020');
    fireEvent.changeText(getByTestId('vehicle-make'), 'Toyota');
    fireEvent.press(getByTestId('submit-button'));
    
    expect(mockOnSubmit).toHaveBeenCalledWith({
      vehicleYear: '2020',
      vehicleMake: 'Toyota'
    });
  });
});
```

## 3. Test Data Management

### 3.1 Test Database Setup

```javascript
// test-setup.js
const { Pool } = require('pg');

const testDb = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: false
});

beforeEach(async () => {
  // Clean database before each test
  await testDb.query('TRUNCATE TABLE inspections, customers, users CASCADE');
});

afterAll(async () => {
  await testDb.end();
});
```

### 3.2 Test Data Factories

```javascript
// test-factories.js
export const createTestUser = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  role: 'SHOP_MANAGER',
  shopId: 'shop-123',
  ...overrides
});

export const createTestCustomer = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  email: 'customer@example.com',
  phone: '+1234567890',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides
});

export const createTestInspection = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174002',
  customerId: 'customer-123',
  vehicleYear: 2020,
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  status: 'DRAFT',
  ...overrides
});
```

## 4. CI/CD Integration

### 4.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: courtesy_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        env:
          TEST_DATABASE_URL: postgresql://postgres:test@localhost/courtesy_test
      
      - name: Check coverage
        run: npm run test:coverage
```

### 4.2 Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

## 5. Manual Testing Procedures

### 5.1 User Acceptance Testing Checklist

**Authentication Flow**:
- [ ] User can register with email and password
- [ ] User can login with valid credentials
- [ ] User is redirected after login
- [ ] Invalid login shows error message
- [ ] Password reset works via email

**Inspection Workflow**:
- [ ] Shop manager can create new inspection
- [ ] Required fields are validated
- [ ] Inspection can be saved as draft
- [ ] Inspection can be completed
- [ ] Customer receives SMS notification

**SMS Communication**:
- [ ] Shop manager can send SMS to customer
- [ ] SMS contains inspection link
- [ ] Customer can view inspection report
- [ ] SMS delivery status is tracked

### 5.2 Cross-Platform Testing

**Web Browsers**:
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Edge (latest)

**Mobile Devices**:
- iOS (iPhone 12+, Safari)
- Android (Chrome mobile)

**Test Scenarios**:
- Responsive design on different screen sizes
- Touch interactions work properly
- Forms submit correctly
- Navigation functions properly

## 6. Bug Tracking & Reporting

### 6.1 Simple Bug Tracking

Use GitHub Issues with labels:
- `bug` - Confirmed bugs
- `testing` - Issues found during testing
- `critical` - Blocks core functionality
- `minor` - Nice to have fixes

### 6.2 Bug Report Template

```markdown
## Bug Report

**Environment**: [Development/Staging/Production]
**Browser/Device**: [Chrome 100, iPhone 13, etc.]
**User Role**: [Shop Manager, Mechanic, Customer]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:

**Actual Behavior**:

**Screenshots**:
[Attach if applicable]
```

## 7. Performance Testing (Basic)

### 7.1 Simple Load Testing

```javascript
// basic-load-test.js
const axios = require('axios');

async function basicLoadTest() {
  const requests = [];
  const numRequests = 10;
  
  for (let i = 0; i < numRequests; i++) {
    requests.push(
      axios.get('http://localhost:3000/api/health')
    );
  }
  
  const start = Date.now();
  const responses = await Promise.all(requests);
  const duration = Date.now() - start;
  
  console.log(`${numRequests} requests completed in ${duration}ms`);
  console.log(`Average response time: ${duration / numRequests}ms`);
  
  const failed = responses.filter(r => r.status !== 200);
  console.log(`Failed requests: ${failed.length}`);
}

basicLoadTest().catch(console.error);
```

## 8. Test Environment Setup

### 8.1 Local Development Testing

```bash
# Setup test database
createdb courtesy_inspection_test

# Run migrations
npm run db:migrate:test

# Install dependencies
npm install

# Run tests
npm test
```

### 8.2 Environment Variables

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://localhost/courtesy_inspection_test
JWT_SECRET=test_jwt_secret_key
SKIP_EMAIL=true
SKIP_SMS=true
```

## MVP Testing Success Criteria

### Coverage Targets
- **Unit Tests**: 30% code coverage
- **Critical Paths**: 100% manual testing coverage
- **API Endpoints**: Core CRUD operations tested
- **User Flows**: All main workflows validated

### Quality Gates
- No critical bugs in core functionality
- All manual test cases pass
- Build passes with test suite
- Performance acceptable for small user base (< 10 shops)

### Release Criteria
- [ ] All critical bugs fixed
- [ ] Manual testing checklist completed
- [ ] Automated tests passing
- [ ] Database migrations tested
- [ ] SMS integration working
- [ ] Basic error handling in place

## Documentation

### 8.3 Testing Documentation

**Test Plan Document**:
- Test scope and objectives
- Testing approach and strategy
- Entry and exit criteria
- Test deliverables

**Test Case Documentation**:
- Manual test cases for each feature
- Expected results
- Pass/fail criteria

This MVP testing strategy provides a solid foundation for ensuring quality while maintaining development speed. The focus on manual testing for critical paths combined with basic automated coverage ensures reliability without over-engineering the testing infrastructure.