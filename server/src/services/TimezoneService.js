/**
 * TimezoneService - Single source of truth for all timezone operations
 * Handles all timezone conversions, business hours, and date formatting
 * Following KISS, DRY, SOLID, YAGNI principles
 */

const moment = require('moment-timezone');

class TimezoneService {
  constructor(db) {
    this.db = db;
    // Cache for shop timezones to reduce DB queries
    this.shopTimezoneCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get shop timezone from cache or database
   */
  async getShopTimezone(shopId) {
    // Check cache first
    const cached = this.shopTimezoneCache.get(shopId);
    if (cached && cached.expires > Date.now()) {
      return cached.timezone;
    }

    // Query database
    const query = `
      SELECT timezone, business_hours 
      FROM shops 
      WHERE id = $1
    `;
    const result = await this.db.query(query, [shopId]);
    
    if (result.rows.length === 0) {
      return 'America/Chicago'; // Default fallback
    }

    const timezone = result.rows[0].timezone || 'America/Chicago';
    
    // Update cache
    this.shopTimezoneCache.set(shopId, {
      timezone,
      businessHours: result.rows[0].business_hours,
      expires: Date.now() + this.cacheTimeout
    });

    return timezone;
  }

  /**
   * Get user timezone preference (if different from shop)
   */
  async getUserTimezone(userId) {
    const query = `
      SELECT timezone 
      FROM users 
      WHERE id = $1 AND timezone IS NOT NULL
    `;
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length > 0 && result.rows[0].timezone) {
      return result.rows[0].timezone;
    }
    
    return null; // User uses shop timezone
  }

  /**
   * Format a timestamp for API response with all needed representations
   * This is the main method that API endpoints will use
   */
  async formatTimestampForResponse(timestamp, shopId, userId = null, options = {}) {
    // Handle null/undefined timestamps
    if (!timestamp) {
      return {
        utc: null,
        display: 'Not set',
        relative: null,
        is_recent: false
      };
    }

    // Ensure we have a moment object in UTC
    const utcMoment = moment.utc(timestamp);
    if (!utcMoment.isValid()) {
      return {
        utc: null,
        display: 'Invalid date',
        relative: null,
        is_recent: false
      };
    }

    // Get the appropriate timezone
    const shopTimezone = await this.getShopTimezone(shopId);
    const userTimezone = userId ? await this.getUserTimezone(userId) : null;
    const displayTimezone = userTimezone || shopTimezone;

    // Convert to display timezone
    const localMoment = utcMoment.clone().tz(displayTimezone);

    // Calculate relative time
    const now = moment();
    const ageInHours = now.diff(utcMoment, 'hours');
    const ageInDays = now.diff(utcMoment, 'days');
    
    // Determine if we should show relative time
    const isRecent = ageInHours < 48; // Show relative for last 48 hours

    // Build response based on options
    const response = {
      // Always include UTC for data operations
      utc: utcMoment.toISOString(),
      
      // Pre-formatted display string
      display: this.formatDisplayString(localMoment, options.format),
      
      // Timezone context
      timezone: displayTimezone,
      timezone_abbr: localMoment.format('z'), // PST, CST, etc.
      
      // Relative time if recent
      is_recent: isRecent
    };

    // Add optional fields based on options
    if (options.includeRelative !== false) { // Default true
      response.relative = this.getRelativeTime(utcMoment);
    }

    if (options.includeBusinessContext) {
      response.business_context = await this.getBusinessContext(utcMoment, shopId);
    }

    if (options.includeAllFormats) {
      response.formats = {
        date_only: localMoment.format('MM/DD/YYYY'),
        time_only: localMoment.format('h:mm A'),
        iso_local: localMoment.format(),
        unix: utcMoment.unix(),
        day_of_week: localMoment.format('dddd')
      };
    }

    return response;
  }

  /**
   * Format display string based on format option
   */
  formatDisplayString(momentObj, format = 'default') {
    switch (format) {
      case 'date':
        return momentObj.format('MM/DD/YYYY');
      case 'time':
        return momentObj.format('h:mm A z');
      case 'short':
        return momentObj.format('MM/DD/YY h:mm A');
      case 'long':
        return momentObj.format('MMMM D, YYYY [at] h:mm A z');
      case 'inspection':
        // Special format for inspection cards
        return momentObj.format('MMM D, YYYY h:mm A z');
      case 'iso':
        return momentObj.format();
      default:
        // Default format with timezone
        return momentObj.format('MM/DD/YYYY h:mm A z');
    }
  }

  /**
   * Get relative time string
   */
  getRelativeTime(utcMoment) {
    const now = moment();
    const diffMinutes = now.diff(utcMoment, 'minutes');
    const diffHours = now.diff(utcMoment, 'hours');
    const diffDays = now.diff(utcMoment, 'days');

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    // For older dates, return the actual date
    return utcMoment.format('MM/DD/YYYY');
  }

  /**
   * Get business context for a timestamp
   */
  async getBusinessContext(utcMoment, shopId) {
    const shopTimezone = await this.getShopTimezone(shopId);
    const shopMoment = utcMoment.clone().tz(shopTimezone);
    
    const cached = this.shopTimezoneCache.get(shopId);
    const businessHours = cached ? cached.businessHours : null;

    const context = {
      is_business_hours: await this.isBusinessHours(shopMoment, businessHours),
      shop_local_time: shopMoment.format('h:mm A'),
      shop_day_of_week: shopMoment.format('dddd')
    };

    // Add next business day if not in business hours
    if (!context.is_business_hours) {
      context.next_business_time = await this.getNextBusinessTime(shopMoment, businessHours);
    }

    return context;
  }

  /**
   * Check if a given time is within business hours
   */
  async isBusinessHours(shopMoment, businessHours) {
    if (!businessHours) {
      // Default business hours
      businessHours = {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: { closed: true }
      };
    }

    const dayOfWeek = shopMoment.format('dddd').toLowerCase();
    const dayHours = businessHours[dayOfWeek];

    if (!dayHours || dayHours.closed) {
      return false;
    }

    const currentTime = shopMoment.format('HH:mm');
    return currentTime >= dayHours.open && currentTime <= dayHours.close;
  }

  /**
   * Get the next business time from a given moment
   */
  async getNextBusinessTime(shopMoment, businessHours) {
    if (!businessHours) {
      // Default to next day at 8 AM
      return shopMoment.clone().add(1, 'day').hour(8).minute(0).format('MM/DD/YYYY [at] h:mm A z');
    }

    let nextMoment = shopMoment.clone();
    const maxDays = 7; // Prevent infinite loop

    for (let i = 0; i < maxDays; i++) {
      nextMoment.add(1, 'day');
      const dayOfWeek = nextMoment.format('dddd').toLowerCase();
      const dayHours = businessHours[dayOfWeek];

      if (dayHours && !dayHours.closed) {
        const [openHour, openMinute] = dayHours.open.split(':').map(Number);
        nextMoment.hour(openHour).minute(openMinute).second(0);
        return nextMoment.format('MM/DD/YYYY [at] h:mm A z');
      }
    }

    return 'Next week';
  }

  /**
   * Convert user input time to UTC for storage
   * Used when users enter dates/times in their local timezone
   */
  async convertToUTC(localTimeString, timezone, format = 'MM/DD/YYYY HH:mm') {
    const localMoment = moment.tz(localTimeString, format, timezone);
    
    if (!localMoment.isValid()) {
      throw new Error('Invalid date/time format');
    }

    return localMoment.utc().toISOString();
  }

  /**
   * Schedule-aware timestamp formatting
   * For future dates that need to maintain "wall clock" time across DST
   */
  async formatScheduledTime(scheduledTimeUTC, shopId, userId = null) {
    const response = await this.formatTimestampForResponse(
      scheduledTimeUTC,
      shopId,
      userId,
      { includeBusinessContext: true }
    );

    // Add scheduling-specific information
    const utcMoment = moment.utc(scheduledTimeUTC);
    const now = moment();
    
    if (utcMoment.isAfter(now)) {
      // Future date
      response.is_future = true;
      response.countdown = this.getCountdown(utcMoment);
      
      // Check if this crosses a DST boundary
      const shopTimezone = await this.getShopTimezone(shopId);
      const willCrossDST = this.willCrossDST(now, utcMoment, shopTimezone);
      if (willCrossDST) {
        response.dst_warning = 'This scheduled time crosses a daylight saving time change';
      }
    } else {
      response.is_future = false;
    }

    return response;
  }

  /**
   * Get countdown string for future dates
   */
  getCountdown(futureMoment) {
    const now = moment();
    const diffHours = futureMoment.diff(now, 'hours');
    const diffDays = futureMoment.diff(now, 'days');

    if (diffHours < 1) {
      const diffMinutes = futureMoment.diff(now, 'minutes');
      return `In ${diffMinutes} minutes`;
    }
    if (diffHours < 24) {
      return `In ${diffHours} hours`;
    }
    if (diffDays < 7) {
      return `In ${diffDays} days`;
    }
    
    return futureMoment.format('MM/DD/YYYY');
  }

  /**
   * Check if a time range crosses DST boundary
   */
  willCrossDST(startMoment, endMoment, timezone) {
    const startOffset = startMoment.tz(timezone).utcOffset();
    const endOffset = endMoment.tz(timezone).utcOffset();
    return startOffset !== endOffset;
  }

  /**
   * Batch format multiple timestamps (efficient for lists)
   */
  async batchFormatTimestamps(timestamps, shopId, userId = null, options = {}) {
    // Pre-fetch timezone once for all timestamps
    const shopTimezone = await this.getShopTimezone(shopId);
    const userTimezone = userId ? await this.getUserTimezone(userId) : null;

    return Promise.all(
      timestamps.map(ts => 
        this.formatTimestampForResponse(ts, shopId, userId, options)
      )
    );
  }

  /**
   * Format date range for display (e.g., reports)
   */
  async formatDateRange(startDate, endDate, shopId) {
    const shopTimezone = await this.getShopTimezone(shopId);
    const start = moment.utc(startDate).tz(shopTimezone);
    const end = moment.utc(endDate).tz(shopTimezone);

    // Same day
    if (start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD')) {
      return `${start.format('MMM D, YYYY')} from ${start.format('h:mm A')} to ${end.format('h:mm A z')}`;
    }

    // Different days
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  }

  /**
   * Get timezone options for UI
   */
  static getSupportedTimezones() {
    return [
      { value: 'America/New_York', label: 'Eastern Time', abbr: 'ET' },
      { value: 'America/Chicago', label: 'Central Time', abbr: 'CT' },
      { value: 'America/Denver', label: 'Mountain Time', abbr: 'MT' },
      { value: 'America/Phoenix', label: 'Arizona Time', abbr: 'MST' },
      { value: 'America/Los_Angeles', label: 'Pacific Time', abbr: 'PT' },
      { value: 'America/Anchorage', label: 'Alaska Time', abbr: 'AKT' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time', abbr: 'HT' },
      { value: 'America/Puerto_Rico', label: 'Atlantic Time', abbr: 'AT' }
    ];
  }

  /**
   * Validate timezone string
   */
  static isValidTimezone(timezone) {
    return moment.tz.zone(timezone) !== null;
  }

  /**
   * Clear cache (useful for testing or when shop settings change)
   */
  clearCache() {
    this.shopTimezoneCache.clear();
  }
}

module.exports = TimezoneService;