# 🚨 PRE-PRODUCTION SECURITY & HARDENING CHECKLIST

**DO NOT DEPLOY TO PRODUCTION UNTIL ALL ITEMS ARE COMPLETED**

## 🔴 CRITICAL SECURITY FIXES (Week 5)

### Authorization & Access Control
- [ ] **Shop Authorization Middleware**
  - [ ] Create `middleware/shopAuth.js` to verify user.shop_id matches resource.shop_id
  - [ ] Apply to ALL routes that access shop-specific data
  - [ ] Test cross-shop access attempts
  - [ ] Verify inspection access limited to owning shop
  - [ ] Verify customer access limited to owning shop
  - [ ] Verify vehicle access limited to owning shop

- [ ] **Portal Token Security**
  - [ ] Replace Base64 encoding with JWT tokens
  - [ ] Add token expiration (24-48 hours)
  - [ ] Store tokens in database with inspection_id reference
  - [ ] Implement token revocation capability
  - [ ] Add rate limiting on token generation

### SQL & Input Security
- [ ] **SQL Injection Prevention**
  - [ ] Audit ALL dynamic query building
  - [ ] Ensure all user inputs are parameterized
  - [ ] Review routes/inspections.js lines 235-275
  - [ ] Add SQL query logging for security audit
  - [ ] Test with SQLMap or similar tool

- [ ] **Input Validation Layer**
  - [ ] Create `middleware/validation.js` using Joi or similar
  - [ ] Validate UUID formats for all ID parameters
  - [ ] Validate enum values (status, severity, urgency)
  - [ ] Validate required fields on all POST/PUT/PATCH
  - [ ] Sanitize string inputs to prevent XSS
  - [ ] Validate file upload types and sizes

### Error Handling & Information Disclosure
- [ ] **Error Response Sanitization**
  - [ ] Create production error handler that strips stack traces
  - [ ] Log full errors server-side, return safe messages to client
  - [ ] Ensure database errors don't leak schema information
  - [ ] Test all error paths for information disclosure

## 🟠 HIGH PRIORITY FIXES (Week 5-6)

### Database Security
- [ ] **Row-Level Security Implementation**
  - [ ] Enable RLS policies in application layer
  - [ ] Use `SET app.current_shop_id` pattern
  - [ ] Test RLS with multiple shops
  - [ ] Verify no data leakage between shops

### Rate Limiting & DoS Protection
- [ ] **Endpoint-Specific Rate Limiting**
  - [ ] Photo uploads: 10 per minute per user
  - [ ] SMS sending: 5 per minute per shop
  - [ ] Login attempts: 5 per 15 minutes per IP
  - [ ] API calls: 100 per minute per user
  - [ ] Implement exponential backoff for repeated failures

### File Security
- [ ] **File Upload Hardening**
  - [ ] Validate file paths to prevent traversal
  - [ ] Implement virus scanning (ClamAV or similar)
  - [ ] Store files outside web root
  - [ ] Generate unique filenames to prevent overwrites
  - [ ] Implement file size limits per shop

## 🟡 PRODUCTION REQUIREMENTS (Week 6)

### Monitoring & Logging
- [ ] **Comprehensive Logging**
  - [ ] Authentication attempts (success/failure)
  - [ ] Authorization failures
  - [ ] Database query performance > 1 second
  - [ ] Error rates by endpoint
  - [ ] File upload/download activity
  - [ ] SMS sending (for billing)

- [ ] **Health Checks & Monitoring**
  - [ ] Database connection health endpoint
  - [ ] Memory usage monitoring
  - [ ] Disk space monitoring for uploads
  - [ ] Queue depth for background jobs
  - [ ] Response time percentiles (p50, p95, p99)

### Performance & Optimization
- [ ] **Database Optimization**
  - [ ] Add indexes for common queries
  - [ ] Implement connection pooling limits
  - [ ] Add query timeout (30 seconds max)
  - [ ] Enable statement timeout in PostgreSQL
  - [ ] Review and optimize N+1 queries

- [ ] **API Performance**
  - [ ] Implement response caching for read operations
  - [ ] Add ETags for client-side caching
  - [ ] Compress responses with gzip
  - [ ] Implement pagination for list endpoints
  - [ ] Add field filtering for large responses

### Configuration & Secrets
- [ ] **Environment Hardening**
  - [ ] Verify all secrets are in environment variables
  - [ ] Rotate all API keys and tokens
  - [ ] Implement secret rotation capability
  - [ ] Document all environment variables
  - [ ] Create production .env.example

### Backup & Recovery
- [ ] **Data Protection**
  - [ ] Implement database backup strategy
  - [ ] Test backup restoration process
  - [ ] Document recovery procedures
  - [ ] Implement soft deletes for critical data
  - [ ] Create data retention policies

## 🟢 NICE-TO-HAVE IMPROVEMENTS

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment runbook
- [ ] Security incident response plan
- [ ] Performance baseline documentation

### Advanced Security
- [ ] Implement CSRF protection
- [ ] Add Content Security Policy headers
- [ ] Implement API key authentication for partners
- [ ] Add webhook signature verification
- [ ] Implement audit trail for sensitive operations

### Compliance
- [ ] GDPR compliance for EU customers
- [ ] Data encryption at rest
- [ ] PII handling procedures
- [ ] Security headers (HSTS, X-Frame-Options, etc.)

## 📋 TESTING REQUIREMENTS

### Security Testing
- [ ] Penetration testing with OWASP ZAP
- [ ] SQL injection testing with SQLMap
- [ ] Authentication bypass attempts
- [ ] Authorization boundary testing
- [ ] File upload vulnerability testing

### Load Testing
- [ ] Concurrent user testing (target: 100 users)
- [ ] Photo upload stress testing
- [ ] Database connection pool testing
- [ ] Memory leak testing (48-hour run)

### Integration Testing
- [ ] End-to-end inspection workflow
- [ ] SMS delivery verification
- [ ] Photo upload and retrieval
- [ ] Customer portal access
- [ ] Mobile app integration

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All critical security fixes completed
- [ ] All high priority fixes completed
- [ ] Production environment variables set
- [ ] Database migrations tested
- [ ] Rollback plan documented

### Deployment Day
- [ ] Database backup taken
- [ ] Monitoring alerts configured
- [ ] Error tracking enabled (Sentry or similar)
- [ ] Load balancer health checks verified
- [ ] SSL certificates valid

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Monitor error rates for 24 hours
- [ ] Review performance metrics
- [ ] Security scan completed
- [ ] Customer communication sent

## 📅 TIMELINE

**Week 5 (Security Sprint)**
- Days 1-2: Critical security fixes
- Days 3-4: High priority fixes
- Day 5: Security testing

**Week 6 (Production Prep)**
- Days 1-2: Performance optimization
- Days 3-4: Load testing and fixes
- Day 5: Deployment preparation

## ⚠️ BLOCKING ISSUES FOR PRODUCTION

**These MUST be fixed before ANY production deployment:**

1. Shop authorization bypass vulnerabilities
2. Insecure portal token system
3. SQL injection risks in dynamic queries
4. Sensitive data exposure in errors
5. Missing input validation

**Estimated Time**: 5-7 days of focused work

## 🎯 DEFINITION OF DONE

Production deployment is authorized when:
- [ ] All critical security fixes are complete
- [ ] All high priority fixes are complete
- [ ] Security testing shows no critical vulnerabilities
- [ ] Load testing meets performance targets
- [ ] Documentation is complete
- [ ] Rollback plan is tested
- [ ] Team sign-off obtained

---

**Last Updated**: August 25, 2025
**Owner**: Development Team
**Review Date**: Week 5 (before production prep)