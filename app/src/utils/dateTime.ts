// DateTime utility for timezone-aware date formatting
// Handles all date/time display logic for the Courtesy Inspection app

import { parseISO, format, isValid, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

export interface DateTimeConfig {
  timezone?: string;
  use24Hour?: boolean;
  dateFormat?: 'US' | 'ISO' | 'EU';
}

export class DateTimeFormatter {
  private config: DateTimeConfig;

  constructor(config: DateTimeConfig = {}) {
    this.config = {
      timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      use24Hour: config.use24Hour || false,
      dateFormat: config.dateFormat || 'US'
    };
  }

  /**
   * Format a UTC timestamp for display in the configured timezone
   */
  formatDateTime(utcString: string | Date | null | undefined): string {
    if (!utcString) return '';
    
    try {
      const date = typeof utcString === 'string' ? parseISO(utcString) : utcString;
      if (!isValid(date)) return 'Invalid date';
      
      const zonedDate = utcToZonedTime(date, this.config.timezone!);
      const timeFormat = this.config.use24Hour ? 'HH:mm' : 'h:mm a';
      const dateFormat = this.getDateFormat();
      
      return format(zonedDate, `${dateFormat} ${timeFormat} zzz`, {
        timeZone: this.config.timezone
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  /**
   * Format just the date portion
   */
  formatDate(utcString: string | Date | null | undefined): string {
    if (!utcString) return '';
    
    try {
      const date = typeof utcString === 'string' ? parseISO(utcString) : utcString;
      if (!isValid(date)) return 'Invalid date';
      
      const zonedDate = utcToZonedTime(date, this.config.timezone!);
      return format(zonedDate, this.getDateFormat(), {
        timeZone: this.config.timezone
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  /**
   * Format just the time portion
   */
  formatTime(utcString: string | Date | null | undefined): string {
    if (!utcString) return '';
    
    try {
      const date = typeof utcString === 'string' ? parseISO(utcString) : utcString;
      if (!isValid(date)) return 'Invalid time';
      
      const zonedDate = utcToZonedTime(date, this.config.timezone!);
      const timeFormat = this.config.use24Hour ? 'HH:mm' : 'h:mm a';
      return format(zonedDate, timeFormat, {
        timeZone: this.config.timezone
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  }

  /**
   * Get relative time string (e.g., "5 minutes ago", "2 days ago")
   */
  getRelativeTime(utcString: string | Date | null | undefined): string {
    if (!utcString) return '';
    
    try {
      const date = typeof utcString === 'string' ? parseISO(utcString) : utcString;
      if (!isValid(date)) return 'Invalid date';
      
      const now = new Date();
      const diffMinutes = differenceInMinutes(now, date);
      const diffHours = differenceInHours(now, date);
      const diffDays = differenceInDays(now, date);

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes === 1) return '1 minute ago';
      if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      
      return this.formatDate(utcString);
    } catch (error) {
      console.error('Error getting relative time:', error);
      return '';
    }
  }

  /**
   * Convert a local date/time to UTC for sending to the backend
   */
  toUTC(localDate: Date | string): string {
    try {
      const date = typeof localDate === 'string' ? parseISO(localDate) : localDate;
      const utcDate = zonedTimeToUtc(date, this.config.timezone!);
      return utcDate.toISOString();
    } catch (error) {
      console.error('Error converting to UTC:', error);
      return new Date().toISOString();
    }
  }

  /**
   * Check if the shop is currently open based on business hours
   */
  isBusinessHours(businessHours?: any): boolean {
    const now = new Date();
    const shopTime = utcToZonedTime(now, this.config.timezone!);
    const hour = shopTime.getHours();
    const day = shopTime.getDay();
    
    // If custom business hours provided, use them
    if (businessHours) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayHours = businessHours[dayNames[day]];
      
      if (!todayHours || todayHours.closed) {
        return false;
      }
      
      const [openHour, openMin] = todayHours.open.split(':').map(Number);
      const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
      const currentMinutes = hour * 60 + shopTime.getMinutes();
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;
      
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }
    
    // Default business hours
    // Monday-Friday: 8 AM - 6 PM
    if (day >= 1 && day <= 5) {
      return hour >= 8 && hour < 18;
    }
    // Saturday: 9 AM - 2 PM
    if (day === 6) {
      return hour >= 9 && hour < 14;
    }
    // Sunday: Closed
    return false;
  }

  /**
   * Get the timezone abbreviation (e.g., PST, CST, EST)
   */
  getTimezoneAbbr(): string {
    const now = new Date();
    const zonedDate = utcToZonedTime(now, this.config.timezone!);
    return format(zonedDate, 'zzz', { timeZone: this.config.timezone });
  }

  /**
   * Format for specific use cases
   */
  formatForInspection(utcString: string | Date | null | undefined): string {
    if (!utcString) return 'Not started';
    
    const formatted = this.formatDateTime(utcString);
    const relative = this.getRelativeTime(utcString);
    
    // For recent times, show relative, otherwise show full date/time
    const date = typeof utcString === 'string' ? parseISO(utcString) : utcString;
    const diffDays = differenceInDays(new Date(), date);
    
    if (diffDays < 1) {
      return relative;
    } else if (diffDays < 7) {
      return `${relative} (${this.formatTime(utcString)})`;
    } else {
      return formatted;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DateTimeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get date format string based on locale preference
   */
  private getDateFormat(): string {
    switch (this.config.dateFormat) {
      case 'ISO': return 'yyyy-MM-dd';
      case 'EU': return 'dd/MM/yyyy';
      case 'US': 
      default: return 'MM/dd/yyyy';
    }
  }
}

// Singleton instance for app-wide use
let defaultFormatter: DateTimeFormatter | null = null;

export const getDefaultFormatter = (): DateTimeFormatter => {
  if (!defaultFormatter) {
    defaultFormatter = new DateTimeFormatter();
  }
  return defaultFormatter;
};

export const updateDefaultTimezone = (timezone: string): void => {
  if (!defaultFormatter) {
    defaultFormatter = new DateTimeFormatter({ timezone });
  } else {
    defaultFormatter.updateConfig({ timezone });
  }
};

// Convenience functions for quick formatting
export const formatDateTime = (date: string | Date | null | undefined, timezone?: string): string => {
  const formatter = timezone 
    ? new DateTimeFormatter({ timezone })
    : getDefaultFormatter();
  return formatter.formatDateTime(date);
};

export const formatDate = (date: string | Date | null | undefined, timezone?: string): string => {
  const formatter = timezone 
    ? new DateTimeFormatter({ timezone })
    : getDefaultFormatter();
  return formatter.formatDate(date);
};

export const formatTime = (date: string | Date | null | undefined, timezone?: string): string => {
  const formatter = timezone 
    ? new DateTimeFormatter({ timezone })
    : getDefaultFormatter();
  return formatter.formatTime(date);
};

export const getRelativeTime = (date: string | Date | null | undefined): string => {
  return getDefaultFormatter().getRelativeTime(date);
};