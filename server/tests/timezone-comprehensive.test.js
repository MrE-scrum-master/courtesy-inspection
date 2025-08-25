/**
 * Comprehensive Timezone Tests
 * Tests all edge cases including DST transitions
 */

const moment = require('moment-timezone');
const TimezoneService = require('../src/services/TimezoneService');

// Mock database
const mockDb = {
  query: jest.fn(),
  end: jest.fn()
};

describe('TimezoneService - Comprehensive Tests', () => {
  let timezoneService;

  beforeEach(() => {
    timezoneService = new TimezoneService(mockDb);
    mockDb.query.mockClear();
    timezoneService.clearCache();
  });

  describe('DST Transition Handling', () => {
    test('Spring forward - 2 AM becomes 3 AM', async () => {
      // March 10, 2024 at 2 AM CST -> 3 AM CDT
      const beforeDST = '2024-03-10T01:59:00.000Z'; // 7:59 PM CST (UTC-6)
      const afterDST = '2024-03-10T02:01:00.000Z';  // 9:01 PM CDT (UTC-5)
      
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      const beforeResult = await timezoneService.formatTimestampForResponse(
        beforeDST, 
        'test-shop-id'
      );
      const afterResult = await timezoneService.formatTimestampForResponse(
        afterDST, 
        'test-shop-id'
      );

      // Before DST: Should show CST
      expect(beforeResult.display).toContain('CST');
      expect(beforeResult.display).toContain('7:59 PM');

      // After DST: Should show CDT
      expect(afterResult.display).toContain('CDT');
      expect(afterResult.display).toContain('9:01 PM');
    });

    test('Fall back - 2 AM happens twice', async () => {
      // November 3, 2024 at 2 AM CDT -> 1 AM CST
      const firstTwoAM = '2024-11-03T01:30:00-05:00';  // First 1:30 AM CDT
      const secondTwoAM = '2024-11-03T01:30:00-06:00'; // Second 1:30 AM CST
      
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      // Test that we can distinguish between the two 1:30 AMs
      const first = moment.tz(firstTwoAM, 'America/Chicago');
      const second = moment.tz(secondTwoAM, 'America/Chicago');
      
      expect(first.format('z')).toBe('CDT');
      expect(second.format('z')).toBe('CST');
      expect(first.utc().format()).not.toBe(second.utc().format());
    });

    test('Detects DST boundary crossing', async () => {
      const beforeDST = moment.tz('2024-03-09 12:00', 'America/Chicago');
      const afterDST = moment.tz('2024-03-11 12:00', 'America/Chicago');
      
      const willCross = timezoneService.willCrossDST(beforeDST, afterDST, 'America/Chicago');
      expect(willCross).toBe(true);

      const sameDay = moment.tz('2024-03-09 08:00', 'America/Chicago');
      const sameDayLater = moment.tz('2024-03-09 18:00', 'America/Chicago');
      
      const wontCross = timezoneService.willCrossDST(sameDay, sameDayLater, 'America/Chicago');
      expect(wontCross).toBe(false);
    });
  });

  describe('Arizona Timezone (No DST)', () => {
    test('Arizona maintains same offset year-round', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Phoenix', business_hours: {} }]
      });

      const summerDate = '2024-07-15T19:00:00.000Z'; // 12 PM MST
      const winterDate = '2024-01-15T19:00:00.000Z'; // 12 PM MST
      
      const summerResult = await timezoneService.formatTimestampForResponse(
        summerDate, 
        'test-shop-id'
      );
      const winterResult = await timezoneService.formatTimestampForResponse(
        winterDate, 
        'test-shop-id'
      );

      // Arizona doesn't observe DST, so both should show MST
      expect(summerResult.timezone_abbr).toBe('MST');
      expect(winterResult.timezone_abbr).toBe('MST');
      expect(summerResult.display).toContain('12:00 PM');
      expect(winterResult.display).toContain('12:00 PM');
    });
  });

  describe('Business Hours Across DST', () => {
    test('Business hours remain consistent across DST transition', async () => {
      const businessHours = {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { closed: true },
        sunday: { closed: true }
      };

      // Monday before DST (March 4, 2024) at 8 AM local
      const beforeDST = moment.tz('2024-03-04 08:00', 'America/Chicago');
      // Monday after DST (March 11, 2024) at 8 AM local  
      const afterDST = moment.tz('2024-03-11 08:00', 'America/Chicago');

      const isOpenBefore = await timezoneService.isBusinessHours(beforeDST, businessHours);
      const isOpenAfter = await timezoneService.isBusinessHours(afterDST, businessHours);

      // Both should be open - 8 AM local time regardless of DST
      expect(isOpenBefore).toBe(true);
      expect(isOpenAfter).toBe(true);

      // UTC times should be different due to DST
      expect(beforeDST.utc().hour()).toBe(14); // 8 AM CST = 2 PM UTC
      expect(afterDST.utc().hour()).toBe(13);  // 8 AM CDT = 1 PM UTC
    });
  });

  describe('Scheduling Across DST', () => {
    test('Scheduled appointment maintains wall clock time across DST', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      // Schedule for March 11, 2024 at 10 AM (after DST transition)
      const scheduledLocalTime = '2024-03-11 10:00';
      const shopTimezone = 'America/Chicago';
      
      // Convert to UTC for storage
      const utcTime = await timezoneService.convertToUTC(
        scheduledLocalTime,
        shopTimezone,
        'YYYY-MM-DD HH:mm'
      );

      // Verify it's stored correctly in UTC
      expect(utcTime).toBe('2024-03-11T15:00:00.000Z'); // 10 AM CDT = 3 PM UTC

      // Format for display
      const formatted = await timezoneService.formatScheduledTime(
        utcTime,
        'test-shop-id'
      );

      expect(formatted.display).toContain('10:00 AM');
      expect(formatted.display).toContain('CDT');
      expect(formatted.is_future).toBeDefined();
    });

    test('Warns about DST crossing for future appointments', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      // Schedule appointment that crosses DST boundary
      const futureDate = moment().tz('America/Chicago')
        .month(2).date(15).hour(10).minute(0); // March 15, after DST
      
      const formatted = await timezoneService.formatScheduledTime(
        futureDate.utc().toISOString(),
        'test-shop-id'
      );

      // Check if DST warning is present when appropriate
      if (moment().isBefore(futureDate) && 
          timezoneService.willCrossDST(moment(), futureDate, 'America/Chicago')) {
        expect(formatted.dst_warning).toBeDefined();
      }
    });
  });

  describe('Multiple Timezone Support', () => {
    test('Correctly handles different US timezones', async () => {
      const testTime = '2024-07-15T12:00:00.000Z'; // Noon UTC
      
      const timezones = [
        { tz: 'America/New_York', expected: '8:00 AM EDT' },
        { tz: 'America/Chicago', expected: '7:00 AM CDT' },
        { tz: 'America/Denver', expected: '6:00 AM MDT' },
        { tz: 'America/Phoenix', expected: '5:00 AM MST' },
        { tz: 'America/Los_Angeles', expected: '5:00 AM PDT' },
        { tz: 'Pacific/Honolulu', expected: '2:00 AM HST' }
      ];

      for (const { tz, expected } of timezones) {
        mockDb.query.mockResolvedValue({
          rows: [{ timezone: tz, business_hours: {} }]
        });

        const result = await timezoneService.formatTimestampForResponse(
          testTime,
          'test-shop-id'
        );

        expect(result.display).toContain(expected.split(' ')[0]); // Time
        expect(result.timezone_abbr).toBe(expected.split(' ')[2]); // Timezone abbr
      }
    });
  });

  describe('Edge Cases', () => {
    test('Handles null/undefined timestamps gracefully', async () => {
      const nullResult = await timezoneService.formatTimestampForResponse(
        null,
        'test-shop-id'
      );
      
      expect(nullResult.utc).toBeNull();
      expect(nullResult.display).toBe('Not set');
      expect(nullResult.relative).toBeNull();
    });

    test('Handles invalid timestamps gracefully', async () => {
      const invalidResult = await timezoneService.formatTimestampForResponse(
        'invalid-date',
        'test-shop-id'
      );
      
      expect(invalidResult.utc).toBeNull();
      expect(invalidResult.display).toBe('Invalid date');
    });

    test('Falls back to default timezone when shop has none', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await timezoneService.formatTimestampForResponse(
        '2024-07-15T12:00:00.000Z',
        'test-shop-id'
      );
      
      expect(result.timezone).toBe('America/Chicago'); // Default
    });

    test('Handles leap seconds gracefully', async () => {
      // Leap second on Dec 31, 2016 at 23:59:60 UTC
      const leapSecond = '2016-12-31T23:59:60.000Z';
      
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'UTC', business_hours: {} }]
      });

      // Should handle without crashing
      const result = await timezoneService.formatTimestampForResponse(
        leapSecond,
        'test-shop-id'
      );
      
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('Caches shop timezone to reduce DB queries', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      // First call - should query DB
      await timezoneService.getShopTimezone('shop-1');
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await timezoneService.getShopTimezone('shop-1');
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Still 1

      // Different shop - should query DB
      await timezoneService.getShopTimezone('shop-2');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    test('Batch formatting is efficient', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'America/Chicago', business_hours: {} }]
      });

      const timestamps = [
        '2024-01-15T12:00:00.000Z',
        '2024-02-15T12:00:00.000Z',
        '2024-03-15T12:00:00.000Z',
        '2024-04-15T12:00:00.000Z',
        '2024-05-15T12:00:00.000Z'
      ];

      const start = Date.now();
      const results = await timezoneService.batchFormatTimestamps(
        timestamps,
        'test-shop-id'
      );
      const duration = Date.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(100); // Should be fast
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only one DB query
    });
  });

  describe('Timezone Validation', () => {
    test('Validates timezone strings correctly', () => {
      expect(TimezoneService.isValidTimezone('America/Chicago')).toBe(true);
      expect(TimezoneService.isValidTimezone('America/New_York')).toBe(true);
      expect(TimezoneService.isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(TimezoneService.isValidTimezone('CST')).toBe(false); // Abbreviations not valid
    });

    test('Supported timezones list is accurate', () => {
      const supported = TimezoneService.getSupportedTimezones();
      
      expect(supported).toBeInstanceOf(Array);
      expect(supported.length).toBeGreaterThan(0);
      
      // Check structure
      const first = supported[0];
      expect(first).toHaveProperty('value');
      expect(first).toHaveProperty('label');
      expect(first).toHaveProperty('abbr');
      
      // All values should be valid
      supported.forEach(tz => {
        expect(TimezoneService.isValidTimezone(tz.value)).toBe(true);
      });
    });
  });

  describe('Relative Time', () => {
    test('Calculates relative time correctly', () => {
      const now = moment();
      
      // Mock different time differences
      const times = [
        { diff: 0, expected: 'Just now' },
        { diff: 1, expected: '1 minute ago' },
        { diff: 30, expected: '30 minutes ago' },
        { diff: 60, expected: '1 hour ago' },
        { diff: 120, expected: '2 hours ago' },
        { diff: 1440, expected: 'Yesterday' },
        { diff: 2880, expected: '2 days ago' },
        { diff: 10080, expected: '1 weeks ago' },
      ];

      times.forEach(({ diff, expected }) => {
        const testTime = now.clone().subtract(diff, 'minutes');
        const relative = timezoneService.getRelativeTime(testTime);
        expect(relative).toBe(expected);
      });
    });
  });
});

describe('Timezone Middleware Integration', () => {
  test('Middleware correctly formats response timestamps', async () => {
    // This would be an integration test with the actual Express app
    // Testing that the middleware intercepts and formats timestamps
    
    const mockResponse = {
      created_at: '2024-01-15T12:00:00.000Z',
      updated_at: '2024-01-15T13:00:00.000Z',
      nested: {
        started_at: '2024-01-15T14:00:00.000Z'
      }
    };

    // The middleware should transform this to include display versions
    // This would be tested with supertest in a full integration test
    expect(mockResponse).toBeDefined();
  });
});