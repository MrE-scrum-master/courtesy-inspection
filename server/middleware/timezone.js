/**
 * Timezone Middleware
 * Automatically enhances API responses with timezone-aware formatting
 * Provides consistent timezone handling across all endpoints
 */

const TimezoneService = require('../services/TimezoneService');

/**
 * Create timezone middleware instance
 */
function createTimezoneMiddleware(db) {
  const timezoneService = new TimezoneService(db);

  /**
   * Middleware to attach timezone service to request
   */
  const attachTimezoneService = (req, res, next) => {
    req.timezoneService = timezoneService;
    next();
  };

  /**
   * Response interceptor to format timestamps
   * This wraps res.json to automatically process timestamps
   */
  const formatResponseTimestamps = (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method
    res.json = async function(data) {
      try {
        // Skip formatting if explicitly disabled
        if (req.query.raw_timestamps === 'true') {
          return originalJson(data);
        }

        // Get user context
        const shopId = req.user?.shopId || req.user?.shop_id;
        const userId = req.user?.id;

        if (!shopId) {
          // No shop context, return as-is
          return originalJson(data);
        }

        // Determine format options from query params
        const formatOptions = {
          includeRelative: req.query.include_relative !== 'false',
          includeBusinessContext: req.query.include_business === 'true',
          includeAllFormats: req.query.include_all === 'true',
          format: req.query.date_format || 'default'
        };

        // Process the response data
        const processedData = await processTimestamps(
          data,
          shopId,
          userId,
          timezoneService,
          formatOptions
        );

        // Add timezone metadata to response
        if (typeof processedData === 'object' && !Array.isArray(processedData)) {
          processedData._metadata = processedData._metadata || {};
          processedData._metadata.timezone = {
            shop_timezone: await timezoneService.getShopTimezone(shopId),
            user_timezone: userId ? await timezoneService.getUserTimezone(userId) : null,
            server_time_utc: new Date().toISOString()
          };
        }

        return originalJson(processedData);
      } catch (error) {
        console.error('Error in timezone middleware:', error);
        // Fall back to original response on error
        return originalJson(data);
      }
    };

    next();
  };

  /**
   * Helper to identify timestamp fields
   */
  function isTimestampField(key) {
    const timestampFields = [
      'created_at', 'updated_at', 'deleted_at',
      'started_at', 'completed_at', 'sent_at',
      'viewed_at', 'scheduled_at', 'expires_at',
      'last_login_at', 'published_at', 'modified_at'
    ];
    
    return timestampFields.includes(key) || 
           key.endsWith('_at') || 
           key.endsWith('_date') || 
           key.endsWith('_time');
  }

  /**
   * Recursively process timestamps in response data
   */
  async function processTimestamps(data, shopId, userId, service, options) {
    // Handle null/undefined
    if (data == null) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return Promise.all(
        data.map(item => processTimestamps(item, shopId, userId, service, options))
      );
    }

    // Handle objects
    if (typeof data === 'object' && !(data instanceof Date)) {
      const processed = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (isTimestampField(key) && value) {
          // Format timestamp field
          const formatted = await service.formatTimestampForResponse(
            value,
            shopId,
            userId,
            options
          );
          
          // Store both original and formatted versions
          processed[key] = formatted.utc; // Keep original UTC
          processed[`${key}_display`] = formatted.display;
          processed[`${key}_relative`] = formatted.relative;
          processed[`${key}_timezone`] = formatted.timezone_abbr;
          
          // Add extra fields if requested
          if (options.includeBusinessContext && formatted.business_context) {
            processed[`${key}_business`] = formatted.business_context;
          }
          if (options.includeAllFormats && formatted.formats) {
            processed[`${key}_formats`] = formatted.formats;
          }
        } else if (typeof value === 'object') {
          // Recursively process nested objects
          processed[key] = await processTimestamps(value, shopId, userId, service, options);
        } else {
          // Keep other fields as-is
          processed[key] = value;
        }
      }
      
      return processed;
    }

    // Return primitives as-is
    return data;
  }

  /**
   * Middleware to format specific timestamp fields in request body
   * Converts user's local time input to UTC for storage
   */
  const parseRequestTimestamps = async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      const shopId = req.user?.shopId || req.user?.shop_id;
      if (!shopId) {
        return next();
      }

      const shopTimezone = await timezoneService.getShopTimezone(shopId);
      const userTimezone = req.user?.id ? 
        await timezoneService.getUserTimezone(req.user.id) : null;
      const inputTimezone = req.body._timezone || userTimezone || shopTimezone;

      // Fields that might contain user-entered dates
      const userDateFields = [
        'scheduled_at', 'appointment_date', 'due_date',
        'start_date', 'end_date', 'follow_up_date'
      ];

      for (const field of userDateFields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // Check if it's already in ISO format (UTC)
          if (!req.body[field].endsWith('Z')) {
            try {
              // Convert from user's timezone to UTC
              req.body[field] = await timezoneService.convertToUTC(
                req.body[field],
                inputTimezone,
                req.body._date_format || 'MM/DD/YYYY HH:mm'
              );
            } catch (error) {
              console.warn(`Could not parse date field ${field}:`, error.message);
            }
          }
        }
      }

      // Remove helper fields
      delete req.body._timezone;
      delete req.body._date_format;

      next();
    } catch (error) {
      console.error('Error parsing request timestamps:', error);
      next();
    }
  };

  return {
    attachTimezoneService,
    formatResponseTimestamps,
    parseRequestTimestamps,
    timezoneService // Expose service for direct use
  };
}

module.exports = createTimezoneMiddleware;