# Courtesy Inspection - Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide helps diagnose and resolve common issues with the Courtesy Inspection platform. Issues are organized by severity and include step-by-step resolution procedures.

## Issue Classification

### Severity Levels
- 🔴 **Critical**: System down, data loss, security breach
- 🟡 **High**: Major functionality impaired, multiple users affected
- 🟢 **Medium**: Minor functionality issues, workarounds available
- 🔵 **Low**: Cosmetic issues, enhancement requests

### Response Times
- **Critical**: Immediate response (within 1 hour)
- **High**: 4-hour response target
- **Medium**: 24-hour response target
- **Low**: 72-hour response target

## Critical Issues (🔴)

### API Server Down

**Symptoms:**
- Cannot access the application
- "Service Unavailable" error messages
- Health check endpoints failing

**Diagnosis:**
```bash
# Check API health
curl -f https://api.courtesy-inspection.com/api/health

# Check Railway service status
railway status --service courtesy-inspection-api --environment production

# View recent logs
railway logs --tail 100 --service courtesy-inspection-api
```

**Resolution:**
```bash
# 1. Check service status
railway status --service courtesy-inspection-api --environment production

# 2. If service is down, restart it
railway restart --service courtesy-inspection-api --environment production

# 3. If issues persist, deploy latest known good version
./scripts/rollback.sh -e production -f

# 4. Monitor logs for errors
railway logs --follow --service courtesy-inspection-api
```

**Escalation:** If not resolved within 30 minutes, contact Railway support and notify stakeholders.

### Database Connection Failed

**Symptoms:**
- API returns 500 errors
- "Database connection failed" in logs
- Cannot save or retrieve data

**Diagnosis:**
```bash
# Check database service
railway status --service courtesy-inspection-db --environment production

# Test database connectivity
railway run "psql \$DATABASE_URL -c 'SELECT 1'" --service courtesy-inspection-db

# Check connection pool status
curl https://api.courtesy-inspection.com/api/health/database
```

**Resolution:**
```bash
# 1. Restart database service
railway restart --service courtesy-inspection-db --environment production

# 2. Check database logs
railway logs --service courtesy-inspection-db --environment production

# 3. Verify connection string
railway variables get DATABASE_URL --service courtesy-inspection-api

# 4. If corrupted, restore from backup
./scripts/backup.sh -e production --restore latest
```

### Data Loss Detected

**Symptoms:**
- Missing inspection records
- Customer data not found
- File upload failures

**Immediate Actions:**
1. **Stop all write operations** to prevent further data loss
2. **Assess scope** of data loss
3. **Notify stakeholders** immediately
4. **Begin recovery process**

**Recovery Process:**
```bash
# 1. Identify latest good backup
./scripts/backup.sh -e production --list

# 2. Restore from backup
./scripts/backup.sh -e production --restore [backup_id]

# 3. Verify data integrity
railway run "npm run db:health" --service courtesy-inspection-api

# 4. Document incident
echo "Data loss incident: $(date)" >> incident-log.txt
```

## High Priority Issues (🟡)

### High Error Rate

**Symptoms:**
- Error rate >5% in monitoring dashboard
- Multiple user complaints
- Increased 500 status codes

**Diagnosis:**
```bash
# Check error rates
curl https://api.courtesy-inspection.com/metrics | grep http_requests_total

# Review error logs
railway logs --service courtesy-inspection-api | grep ERROR

# Check specific endpoints
railway logs --service courtesy-inspection-api | grep "POST /api/inspections"
```

**Resolution:**
```bash
# 1. Identify error patterns
railway logs --service courtesy-inspection-api | grep ERROR | head -20

# 2. Check for recent deployments
git log --oneline -10

# 3. If caused by recent deployment, rollback
./scripts/rollback.sh -e production

# 4. Monitor error rates after action
watch "curl -s https://api.courtesy-inspection.com/metrics | grep error_rate"
```

### Slow Response Times

**Symptoms:**
- Response times >2 seconds
- User complaints about slowness
- Timeout errors

**Diagnosis:**
```bash
# Check response time metrics
curl https://api.courtesy-inspection.com/metrics | grep http_request_duration

# Database query performance
railway run "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10" --service courtesy-inspection-db

# Check system resources
railway metrics --service courtesy-inspection-api
```

**Resolution:**
```bash
# 1. Scale up resources temporarily
railway configure --memory 2Gi --service courtesy-inspection-api

# 2. Restart application to clear memory
railway restart --service courtesy-inspection-api

# 3. Check for slow queries
railway run "SELECT query, mean_time FROM pg_stat_statements WHERE mean_time > 1000" --service courtesy-inspection-db

# 4. Optimize queries if needed
# (This would require code changes and deployment)
```

### File Upload Failures

**Symptoms:**
- Photos not uploading
- "Upload failed" error messages
- Timeouts during large uploads

**Diagnosis:**
```bash
# Check upload endpoint health
curl -f https://api.courtesy-inspection.com/api/upload/health

# Check storage space
railway run "df -h" --service courtesy-inspection-api

# Review upload logs
railway logs --service courtesy-inspection-api | grep upload
```

**Resolution:**
```bash
# 1. Check storage volume space
railway volumes list --service courtesy-inspection-api

# 2. If space is low, expand volume
railway volumes expand --size 10GB --service courtesy-inspection-api

# 3. Restart service
railway restart --service courtesy-inspection-api

# 4. Test upload functionality
curl -X POST -F "file=@test.jpg" https://api.courtesy-inspection.com/api/upload/test
```

## Medium Priority Issues (🟢)

### SMS Delivery Failures

**Symptoms:**
- SMS notifications not delivered
- High SMS failure rate
- Customer complaints about missing notifications

**Diagnosis:**
```bash
# Check SMS service logs
railway logs --service courtesy-inspection-api | grep SMS

# Verify Telnyx configuration
railway variables get TELNYX_API_KEY --service courtesy-inspection-api

# Test SMS endpoint
curl -X POST https://api.courtesy-inspection.com/api/sms/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"to": "+1234567890", "message": "Test"}'
```

**Resolution:**
```bash
# 1. Verify Telnyx account status
# (Check Telnyx dashboard for account issues)

# 2. Test with different phone number
curl -X POST https://api.courtesy-inspection.com/api/sms/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"to": "+1555123456", "message": "Test message"}'

# 3. Check rate limits
# Review Telnyx rate limiting in dashboard

# 4. Update configuration if needed
railway variables set TELNYX_PHONE_NUMBER="+1234567890" --service courtesy-inspection-api
```

### Authentication Issues

**Symptoms:**
- Users cannot log in
- "Invalid token" errors
- JWT token expiration issues

**Diagnosis:**
```bash
# Check authentication logs
railway logs --service courtesy-inspection-api | grep auth

# Verify JWT secret
railway variables get JWT_SECRET --service courtesy-inspection-api

# Test login endpoint
curl -X POST https://api.courtesy-inspection.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'
```

**Resolution:**
```bash
# 1. Check JWT secret is set and valid
railway variables get JWT_SECRET --service courtesy-inspection-api

# 2. If secret is missing or invalid, regenerate
railway variables set JWT_SECRET="$(openssl rand -base64 32)" --service courtesy-inspection-api

# 3. Restart service to apply changes
railway restart --service courtesy-inspection-api

# 4. Test authentication
curl -X POST https://api.courtesy-inspection.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shop.com", "password": "password123"}'
```

### Email Notification Failures

**Symptoms:**
- Email notifications not sent
- SMTP connection errors
- Bounced emails

**Diagnosis:**
```bash
# Check email logs
railway logs --service courtesy-inspection-api | grep email

# Verify SMTP configuration
railway variables get SMTP_HOST --service courtesy-inspection-api
railway variables get SMTP_PORT --service courtesy-inspection-api

# Test email endpoint
curl -X POST https://api.courtesy-inspection.com/api/email/test \
  -H "Authorization: Bearer $TOKEN"
```

**Resolution:**
```bash
# 1. Verify SMTP credentials
railway variables get SMTP_USERNAME --service courtesy-inspection-api

# 2. Test SMTP connection
railway run "telnet \$SMTP_HOST \$SMTP_PORT" --service courtesy-inspection-api

# 3. Update SMTP settings if needed
railway variables set SMTP_HOST="smtp.gmail.com" --service courtesy-inspection-api
railway variables set SMTP_PORT="587" --service courtesy-inspection-api

# 4. Restart service
railway restart --service courtesy-inspection-api
```

## Low Priority Issues (🔵)

### UI Display Issues

**Symptoms:**
- Cosmetic display problems
- Layout issues on specific devices
- Minor visual glitches

**Diagnosis:**
1. Identify affected devices/browsers
2. Check browser console for errors
3. Verify CSS and JavaScript loading
4. Test on different screen sizes

**Resolution:**
1. Clear browser cache
2. Update to latest app version
3. Report to development team for future update

### Performance Optimization

**Symptoms:**
- App feels slower than optimal
- Higher than desired resource usage
- Room for improvement in metrics

**Analysis:**
```bash
# Check current performance metrics
curl https://api.courtesy-inspection.com/metrics

# Database performance analysis
railway run "SELECT * FROM pg_stat_activity" --service courtesy-inspection-db

# Memory usage analysis
railway metrics --service courtesy-inspection-api --metric memory
```

**Optimization:**
1. Implement caching strategies
2. Optimize database queries
3. Configure CDN for static assets
4. Enable compression

## Debugging Workflows

### General Debugging Process

1. **Identify Symptoms**
   - Gather user reports
   - Check monitoring alerts
   - Review error logs

2. **Reproduce Issue**
   - Test in staging environment
   - Document reproduction steps
   - Identify environmental factors

3. **Analyze Root Cause**
   - Review recent changes
   - Check system metrics
   - Examine error patterns

4. **Implement Fix**
   - Apply temporary workaround if needed
   - Develop proper fix
   - Test thoroughly

5. **Verify Resolution**
   - Monitor metrics
   - Get user confirmation
   - Document solution

### Log Analysis

#### Common Log Patterns

**Database Errors:**
```bash
# Connection issues
railway logs --service courtesy-inspection-api | grep "connection.*failed"

# Query timeouts
railway logs --service courtesy-inspection-api | grep "timeout"

# Lock conflicts
railway logs --service courtesy-inspection-api | grep "deadlock"
```

**Performance Issues:**
```bash
# Slow requests
railway logs --service courtesy-inspection-api | grep "duration.*[5-9][0-9][0-9][0-9]"

# Memory warnings
railway logs --service courtesy-inspection-api | grep "memory"

# CPU spikes
railway logs --service courtesy-inspection-api | grep "cpu"
```

**Security Events:**
```bash
# Failed authentication attempts
railway logs --service courtesy-inspection-api | grep "auth.*failed"

# Rate limiting triggers
railway logs --service courtesy-inspection-api | grep "rate.*limit"

# Suspicious activity
railway logs --service courtesy-inspection-api | grep "security"
```

### Environment-Specific Issues

#### Development Environment
```bash
# Check local services
npm run dev          # Start development server
npm run test         # Run test suite
npm run lint         # Check code quality
```

#### Staging Environment
```bash
# Deploy to staging
./scripts/deploy.sh -e staging

# Run staging tests
npm run test:staging

# Check staging logs
railway logs --service courtesy-inspection-api --environment staging
```

#### Production Environment
```bash
# Check production health
curl https://api.courtesy-inspection.com/api/health

# Monitor production metrics
railway metrics --service courtesy-inspection-api --environment production

# Production logs (be careful with sensitive data)
railway logs --service courtesy-inspection-api --environment production --tail 50
```

## Monitoring and Alerts

### Key Metrics to Monitor

#### Application Metrics
- **Response Time**: <2 seconds average
- **Error Rate**: <1% for critical endpoints
- **Throughput**: Requests per minute
- **Availability**: >99.9% uptime

#### Infrastructure Metrics
- **CPU Usage**: <70% average
- **Memory Usage**: <80% of allocated
- **Disk Space**: <80% full
- **Database Connections**: <50% of pool

#### Business Metrics
- **Inspection Success Rate**: >95%
- **SMS Delivery Rate**: >98%
- **Customer Satisfaction**: >4.5/5 average
- **Revenue Impact**: Track inspection-to-repair conversion

### Alert Configuration

#### Critical Alerts (Immediate)
- API downtime >1 minute
- Error rate >5%
- Database connection failures
- Memory usage >90%

#### Warning Alerts (5-15 minutes)
- Response time >2 seconds
- Error rate >1%
- CPU usage >80%
- Disk space >80%

#### Info Alerts (30+ minutes)
- Deployment completions
- Backup successes
- Performance milestones

## Escalation Procedures

### Internal Escalation

#### Level 1: On-Call Engineer
- **Response Time**: Within 1 hour
- **Scope**: Handle routine issues and known problems
- **Escalate When**: Unable to resolve within 2 hours

#### Level 2: Technical Lead
- **Response Time**: Within 2 hours
- **Scope**: Complex technical issues, system architecture
- **Escalate When**: Requires architectural changes or >4 hour outage

#### Level 3: Management
- **Response Time**: Within 4 hours
- **Scope**: Business impact decisions, customer communication
- **Escalate When**: Significant business impact or data breach

### External Escalation

#### Railway Support
- **Contact**: Railway support portal
- **When**: Infrastructure issues beyond our control
- **Information Needed**: Service names, error messages, timeline

#### Telnyx Support
- **Contact**: Telnyx support dashboard
- **When**: SMS delivery issues
- **Information Needed**: Phone numbers, message IDs, error codes

#### Customer Communication
- **Timing**: Within 1 hour for critical issues
- **Channels**: Email, SMS, in-app notifications
- **Content**: Status, timeline, workarounds

## Recovery Procedures

### Backup and Restore

#### Database Backup
```bash
# Create immediate backup
./scripts/backup.sh -e production -c -v

# List available backups
./scripts/backup.sh -e production --list

# Restore from backup
./scripts/backup.sh -e production --restore [backup_id]
```

#### Application Rollback
```bash
# Rollback to previous deployment
./scripts/rollback.sh -e production

# Rollback with database restore
./scripts/rollback.sh -e production -r
```

#### File System Recovery
```bash
# Check volume status
railway volumes list --service courtesy-inspection-api

# Restore files from backup
railway run "tar -xzf /backup/files.tar.gz -C /app/uploads" --service courtesy-inspection-api
```

### Disaster Recovery

#### Complete System Recovery
1. **Assess Damage**: Determine scope of issue
2. **Stop Services**: Prevent further damage
3. **Restore Database**: From most recent backup
4. **Restore Files**: From file system backup
5. **Redeploy Application**: From known good version
6. **Verify Functionality**: Complete system test
7. **Resume Operations**: Gradually restore traffic

#### Data Center Outage
1. **Activate Secondary Region**: If configured
2. **Update DNS**: Point to backup infrastructure
3. **Communicate Status**: Notify stakeholders
4. **Monitor Recovery**: Track Railway status updates
5. **Resume Primary**: Switch back when available

## Prevention Strategies

### Proactive Monitoring
- Implement comprehensive health checks
- Set up automated alerting
- Regular performance baselines
- Capacity planning reviews

### Code Quality
- Automated testing pipelines
- Code review requirements
- Security scanning
- Performance testing

### Infrastructure
- Regular backup testing
- Disaster recovery drills
- Security audits
- Dependency updates

### Documentation
- Keep runbooks updated
- Document all procedures
- Maintain contact lists
- Record lessons learned

## Support Contacts

### Internal Team
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Technical Lead**: tech-lead@courtesy-inspection.com
- **DevOps**: devops@courtesy-inspection.com
- **Management**: management@courtesy-inspection.com

### External Support
- **Railway Support**: https://railway.app/help
- **Telnyx Support**: https://telnyx.com/support
- **Emergency Hotline**: 1-800-XXX-XXXX

### Communication Channels
- **Slack**: #incidents, #alerts
- **Email**: incidents@courtesy-inspection.com
- **Status Page**: status.courtesy-inspection.com
- **Documentation**: docs.courtesy-inspection.com

---

*This troubleshooting guide is maintained by the Courtesy Inspection technical team. For updates or additions, contact: docs@courtesy-inspection.com*

*Last Updated: January 2024*