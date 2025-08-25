/**
 * TimezoneService - Simple JavaScript implementation
 * Handles timezone operations for the inspection app
 */

const moment = require('moment-timezone');

class TimezoneService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get shop timezone
   */
  async getShopTimezone(shopId) {
    try {
      const result = await this.db.query(
        'SELECT timezone FROM shops WHERE id = $1',
        [shopId]
      );
      return result.rows[0]?.timezone || 'America/New_York';
    } catch (error) {
      console.error('Error getting shop timezone:', error);
      return 'America/New_York';
    }
  }

  /**
   * Get user timezone preference
   */
  async getUserTimezone(userId) {
    try {
      const result = await this.db.query(
        'SELECT timezone FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0]?.timezone || null;
    } catch (error) {
      console.error('Error getting user timezone:', error);
      return null;
    }
  }

  /**
   * Format timestamp for API response
   */
  async formatTimestampForResponse(timestamp, shopId, userId, options = {}) {
    try {
      const shopTimezone = await this.getShopTimezone(shopId);
      const userTimezone = userId ? await this.getUserTimezone(userId) : null;
      const displayTimezone = userTimezone || shopTimezone;

      const utcMoment = moment.utc(timestamp);
      const localMoment = utcMoment.clone().tz(displayTimezone);

      return {
        utc: utcMoment.toISOString(),
        display: localMoment.format('MMM DD, YYYY HH:mm'),
        relative: localMoment.fromNow(),
        timezone_abbr: localMoment.format('z')
      };
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return {
        utc: timestamp,
        display: timestamp,
        relative: 'unknown',
        timezone_abbr: 'UTC'
      };
    }
  }

  /**
   * Convert user input to UTC
   */
  async convertToUTC(dateString, timezone, format = 'MM/DD/YYYY HH:mm') {
    try {
      const localMoment = moment.tz(dateString, format, timezone);
      return localMoment.utc().toISOString();
    } catch (error) {
      console.error('Error converting to UTC:', error);
      throw error;
    }
  }
}

module.exports = TimezoneService;