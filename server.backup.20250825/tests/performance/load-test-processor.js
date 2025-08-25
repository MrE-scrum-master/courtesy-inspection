/**
 * Artillery Load Test Processor
 * Custom functions and hooks for load testing
 */

const { v4: uuidv4 } = require('uuid');

// Custom template functions
module.exports = {
  // Generate random UUID
  uuid: function(context, events, done) {
    context.vars.uuid = uuidv4();
    return done();
  },

  // Generate timestamp
  timestamp: function(context, events, done) {
    context.vars.timestamp = Date.now();
    return done();
  },

  // Generate random string
  randomString: function(context, events, done) {
    const length = 10;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    context.vars.randomString = result;
    return done();
  },

  // Generate random VIN
  randomVIN: function(context, events, done) {
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // Excludes I, O, Q
    let vin = '';
    for (let i = 0; i < 17; i++) {
      vin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    context.vars.randomVIN = vin;
    return done();
  },

  // Custom request logging
  logRequest: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      console.log(`❌ ${requestParams.method} ${requestParams.url} - ${response.statusCode}`);
      if (response.body) {
        console.log(`   Error: ${JSON.stringify(response.body)}`);
      }
    } else if (process.env.VERBOSE_LOGGING) {
      console.log(`✅ ${requestParams.method} ${requestParams.url} - ${response.statusCode}`);
    }
    return next();
  },

  // Performance metrics tracking
  trackMetrics: function(requestParams, response, context, ee, next) {
    const responseTime = response.timings.phases.total;
    
    // Track slow requests
    if (responseTime > 1000) {
      ee.emit('counter', 'slow_requests', 1);
      console.log(`🐌 Slow request: ${requestParams.url} took ${responseTime}ms`);
    }
    
    // Track by endpoint
    const endpoint = requestParams.url.split('?')[0]; // Remove query params
    ee.emit('histogram', `response_time_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, responseTime);
    
    // Track error rates by endpoint
    if (response.statusCode >= 400) {
      ee.emit('counter', `errors_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, 1);
    }
    
    return next();
  },

  // Database connection health check
  checkDatabaseHealth: function(context, events, done) {
    const request = require('request');
    
    request.get({
      url: `${context.vars.target}/api/health/database`,
      json: true,
      timeout: 5000
    }, (error, response, body) => {
      if (error || response.statusCode !== 200) {
        console.log('⚠️ Database health check failed');
        events.emit('customMetric', 'database_health_failures', 1);
      } else {
        const connections = body.connections || {};
        console.log(`📊 DB Connections - Active: ${connections.active}, Idle: ${connections.idle}`);
        
        // Alert if connection pool is nearly exhausted
        if (connections.active > 80) {
          console.log('🚨 High database connection usage detected');
          events.emit('customMetric', 'high_db_connections', 1);
        }
      }
      return done();
    });
  },

  // Memory usage monitoring
  checkMemoryUsage: function(context, events, done) {
    const request = require('request');
    
    request.get({
      url: `${context.vars.target}/api/health/memory`,
      json: true,
      timeout: 5000
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const memoryUsage = body.memory || {};
        const usedMemoryMB = Math.round(memoryUsage.used / 1024 / 1024);
        const totalMemoryMB = Math.round(memoryUsage.total / 1024 / 1024);
        const usagePercent = Math.round((memoryUsage.used / memoryUsage.total) * 100);
        
        console.log(`💾 Memory Usage: ${usedMemoryMB}MB / ${totalMemoryMB}MB (${usagePercent}%)`);
        
        events.emit('histogram', 'memory_usage_percent', usagePercent);
        
        // Alert on high memory usage
        if (usagePercent > 85) {
          console.log('🚨 High memory usage detected');
          events.emit('counter', 'high_memory_usage', 1);
        }
      }
      return done();
    });
  },

  // Authentication token generator
  generateAuthToken: function(context, events, done) {
    const request = require('request');
    
    request.post({
      url: `${context.vars.target}/api/auth/login`,
      json: {
        email: 'loadtest@example.com',
        password: 'LoadTest123!'
      },
      timeout: 10000
    }, (error, response, body) => {
      if (!error && response.statusCode === 200 && body.token) {
        context.vars.authToken = body.token;
        context.vars.userId = body.user.id;
        context.vars.shopId = body.user.shop_id;
      } else {
        console.log('❌ Failed to generate auth token for load test');
        events.emit('counter', 'auth_failures', 1);
      }
      return done();
    });
  },

  // Test data cleanup
  cleanupTestData: function(context, events, done) {
    if (!context.vars.authToken) {
      return done();
    }

    const request = require('request');
    
    // Clean up any test inspections created during load test
    request.delete({
      url: `${context.vars.target}/api/test/cleanup`,
      headers: {
        'Authorization': `Bearer ${context.vars.authToken}`
      },
      json: true,
      timeout: 5000
    }, (error, response, body) => {
      if (error) {
        console.log('⚠️ Failed to cleanup test data');
      } else {
        console.log('🧹 Test data cleaned up');
      }
      return done();
    });
  },

  // Validate response structure
  validateResponse: function(requestParams, response, context, ee, next) {
    try {
      if (response.headers['content-type']?.includes('application/json')) {
        const body = JSON.parse(response.body);
        
        // Validate standard API response structure
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (!body.hasOwnProperty('success')) {
            ee.emit('counter', 'invalid_response_structure', 1);
            console.log(`⚠️ Response missing 'success' field: ${requestParams.url}`);
          }
        } else if (response.statusCode >= 400) {
          if (!body.hasOwnProperty('error')) {
            ee.emit('counter', 'invalid_error_structure', 1);
            console.log(`⚠️ Error response missing 'error' field: ${requestParams.url}`);
          }
        }
      }
    } catch (parseError) {
      if (response.headers['content-type']?.includes('application/json')) {
        ee.emit('counter', 'invalid_json_responses', 1);
        console.log(`⚠️ Invalid JSON response: ${requestParams.url}`);
      }
    }
    
    return next();
  },

  // Rate limit monitoring
  checkRateLimits: function(requestParams, response, context, ee, next) {
    if (response.statusCode === 429) {
      ee.emit('counter', 'rate_limit_hits', 1);
      
      const retryAfter = response.headers['retry-after'];
      if (retryAfter) {
        console.log(`🚦 Rate limited, retry after: ${retryAfter}s`);
        ee.emit('histogram', 'rate_limit_retry_after', parseInt(retryAfter));
      }
    }
    
    // Check for rate limit headers
    const remaining = response.headers['x-ratelimit-remaining'];
    const limit = response.headers['x-ratelimit-limit'];
    
    if (remaining && limit) {
      const usagePercent = ((limit - remaining) / limit) * 100;
      ee.emit('histogram', 'rate_limit_usage_percent', usagePercent);
      
      if (usagePercent > 90) {
        console.log(`🚦 Rate limit nearly exhausted: ${remaining}/${limit}`);
        ee.emit('counter', 'rate_limit_warnings', 1);
      }
    }
    
    return next();
  },

  // Custom before hook for test setup
  beforeTest: function(context, events, done) {
    console.log('🚀 Starting load test session');
    
    // Set up custom variables
    context.vars.testSessionId = uuidv4();
    context.vars.startTime = Date.now();
    
    // Initialize performance counters
    events.emit('counter', 'test_sessions_started', 1);
    
    return done();
  },

  // Custom after hook for test cleanup
  afterTest: function(context, events, done) {
    const duration = Date.now() - (context.vars.startTime || 0);
    console.log(`✅ Test session completed in ${duration}ms`);
    
    events.emit('histogram', 'test_session_duration', duration);
    events.emit('counter', 'test_sessions_completed', 1);
    
    return done();
  }
};

// Global hooks for Artillery
module.exports.beforeScenario = function(context, events, done) {
  // Generate unique test identifiers
  context.vars.scenarioId = uuidv4();
  return done();
};

module.exports.afterScenario = function(context, events, done) {
  // Clean up scenario-specific data if needed
  return done();
};