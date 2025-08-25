# Timezone Architecture Documentation

## Executive Summary

The Courtesy Inspection application implements a **backend-driven timezone architecture** where the backend handles all timezone logic and provides pre-formatted display strings to the frontend. This approach follows KISS, DRY, SOLID, and YAGNI principles while ensuring DST-aware, production-ready timezone handling.

## Architecture Overview

```
┌─────────────┐
│   Frontend  │ ← Displays pre-formatted strings
└──────┬──────┘
       │ 
       │ API Response with:
       │ • UTC timestamp
       │ • Display string
       │ • Relative time
       │ • Timezone context
       ▼
┌─────────────┐
│   Backend   │ ← All timezone logic here
│             │   • TimezoneService
│             │   • Middleware
│             │   • Business rules
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PostgreSQL │ ← TIMESTAMPTZ (UTC)
└─────────────┘
```

## Core Components

### 1. TimezoneService (`server/src/services/TimezoneService.js`)

**Purpose**: Single source of truth for all timezone operations

**Key Features**:
- Handles UTC ↔ Timezone conversions using moment-timezone
- Formats timestamps for display with DST awareness
- Manages business hours calculations
- Provides relative time calculations
- Caches shop timezones for performance
- Validates timezone strings
- Handles scheduling across DST boundaries

**Main Methods**:
```javascript
// Primary method for API responses
formatTimestampForResponse(timestamp, shopId, userId, options)
// Returns: { utc, display, relative, timezone, is_recent, business_context }

// Convert user input to UTC for storage
convertToUTC(localTimeString, timezone, format)

// Check business hours
isBusinessHours(shopMoment, businessHours)

// Handle scheduled times with DST awareness
formatScheduledTime(scheduledTimeUTC, shopId, userId)
```

### 2. Timezone Middleware (`server/middleware/timezone.js`)

**Purpose**: Automatically enhance API responses with formatted timestamps

**Features**:
- Intercepts all API responses
- Identifies timestamp fields (ending in `_at`, `_date`, `_time`)
- Adds formatted versions (`_display`, `_relative`, `_timezone`)
- Includes timezone metadata in responses
- Parses user input timestamps to UTC

**Response Enhancement Example**:
```javascript
// Original response
{
  created_at: "2024-01-15T16:30:00.000Z"
}

// Enhanced response
{
  created_at: "2024-01-15T16:30:00.000Z",
  created_at_display: "01/15/2024 10:30 AM CST",
  created_at_relative: "2 hours ago",
  created_at_timezone: "CST",
  _metadata: {
    timezone: {
      shop_timezone: "America/Chicago",
      user_timezone: null,
      server_time_utc: "2024-01-15T18:30:00.000Z"
    }
  }
}
```

### 3. Database Schema

**Storage**: All timestamps use `TIMESTAMPTZ` (timezone-aware)

**Shop Configuration**:
```sql
shops table:
- timezone VARCHAR(50) -- IANA timezone identifier
- business_hours JSONB -- Operating hours per day

users table:
- timezone VARCHAR(50) -- Optional user override
- date_format VARCHAR(10) -- US/ISO/EU
- use_24hour_time BOOLEAN
```

### 4. Frontend Utilities (`app/src/utils/dateTimeSimple.ts`)

**Purpose**: Simple display helpers - no timezone math

**Key Functions**:
```typescript
// Just display what backend provides
displayDateTime(backendResponse) → string

// Smart display (relative vs absolute)
smartDisplay(backendResponse) → string

// Only timezone work: prepare user input for backend
prepareForBackend(userInput) → ISO string
```

## Design Decisions & Rationale

### Why Backend-Driven?

1. **Single Source of Truth**: One timezone database (backend) vs multiple (each client)
2. **Consistency**: All clients see the same formatted times
3. **Performance**: No timezone library needed in frontend (saves ~70KB)
4. **Simplicity**: Frontend just displays strings, no complex logic
5. **Testing**: Easier to test timezone logic in one place
6. **DST Handling**: Backend's moment-timezone handles all DST transitions

### Why Send Multiple Formats?

```javascript
{
  utc: "2024-01-15T16:30:00.000Z",      // For data operations
  display: "01/15/2024 10:30 AM CST",   // For UI display
  relative: "2 hours ago",               // For recent items
  is_recent: true                        // For display logic
}
```

- **UTC**: Needed for sorting, filtering, comparisons
- **Display**: Pre-formatted for immediate display
- **Relative**: Better UX for recent items
- **Context**: Helps frontend choose what to show

### DST Handling Strategy

1. **Storage**: Always store UTC in database (never changes)
2. **Display**: Convert to shop timezone with moment-timezone (DST-aware)
3. **Scheduling**: Store intent + timezone for future dates
4. **Business Hours**: Use "wall clock" time (8 AM is 8 AM regardless of DST)
5. **Warnings**: Alert users when appointments cross DST boundaries

## API Usage Examples

### Query Parameters

Control response richness with query parameters:

```
GET /api/inspections?include_relative=true&include_business=true
GET /api/inspections?date_format=long&include_all=true
GET /api/inspections?raw_timestamps=true  // Disable formatting
```

### Shop Settings Endpoint

```javascript
GET /api/shops/:shopId/settings
Response:
{
  timezone: "America/Chicago",
  business_hours: {
    monday: { open: "08:00", close: "18:00" },
    // ...
  }
}

PATCH /api/shops/:shopId/settings
Body:
{
  timezone: "America/New_York",
  business_hours: { /* updated hours */ }
}
```

### Supported Timezones

```javascript
GET /api/timezones
Response:
[
  { value: "America/New_York", label: "Eastern Time", abbr: "ET" },
  { value: "America/Chicago", label: "Central Time", abbr: "CT" },
  { value: "America/Denver", label: "Mountain Time", abbr: "MT" },
  { value: "America/Phoenix", label: "Arizona Time", abbr: "MST" },
  { value: "America/Los_Angeles", label: "Pacific Time", abbr: "PT" },
  // ...
]
```

## Edge Cases Handled

### DST Transitions
- **Spring Forward** (2 AM → 3 AM): Handled automatically by moment-timezone
- **Fall Back** (2 AM happens twice): Distinguishes between first and second occurrence
- **Scheduling**: Maintains "wall clock" time across DST changes
- **Warnings**: Alerts when appointments cross DST boundaries

### Special Timezones
- **Arizona** (No DST): Always MST, no transitions
- **Hawaii** (No DST): Always HST
- **Future Changes**: moment-timezone database updates handle rule changes

### Error Handling
- **Invalid Timestamps**: Returns "Invalid date" display string
- **Null/Undefined**: Returns "Not set" display string
- **Invalid Timezone**: Falls back to shop default or system default
- **Cache Misses**: Queries database and rebuilds cache

## Performance Optimizations

1. **Caching**: Shop timezones cached for 5 minutes
2. **Batch Processing**: Multiple timestamps formatted efficiently
3. **Lazy Loading**: Business context only calculated when requested
4. **Smart Defaults**: Common formats included, extras opt-in

## Testing Strategy

### Unit Tests (`server/tests/timezone-comprehensive.test.js`)
- DST transition handling
- Multiple timezone support
- Business hours calculations
- Relative time accuracy
- Edge cases (null, invalid, etc.)
- Performance benchmarks

### Integration Tests
- Middleware formatting
- API response structure
- Database timezone storage
- End-to-end workflows

### Test Coverage Areas
- ✅ DST spring forward/fall back
- ✅ Arizona/Hawaii (no DST)
- ✅ Business hours across DST
- ✅ Scheduling future appointments
- ✅ All US timezones
- ✅ Invalid input handling
- ✅ Cache behavior
- ✅ Batch operations

## Migration Guide

### From Old System

1. **Database Migration** (`server/migrations/005_timezone_fix.sql`)
   - Converts TIMESTAMP → TIMESTAMPTZ
   - Adds timezone columns
   - Creates helper functions

2. **Backend Updates**
   - Remove hardcoded timezone offsets
   - Add TimezoneService initialization
   - Apply middleware globally

3. **Frontend Simplification**
   - Remove timezone conversion logic
   - Use display helpers
   - Update components to use pre-formatted values

## Best Practices

### DO ✅
- Store all timestamps as UTC in database
- Use TIMESTAMPTZ for timezone awareness
- Let backend handle all timezone logic
- Cache timezone data appropriately
- Test DST transitions thoroughly
- Provide timezone context in API responses
- Use IANA timezone identifiers (not abbreviations)

### DON'T ❌
- Use hardcoded timezone offsets
- Do timezone math manually
- Trust client timestamps for business logic
- Store local times in database
- Mix timezone responsibilities
- Ignore DST transitions
- Use timezone abbreviations for logic

## Troubleshooting

### Common Issues

**Issue**: Times off by 1 hour
**Cause**: DST transition
**Solution**: Ensure using moment-timezone, not manual offsets

**Issue**: Business hours wrong
**Cause**: Not using wall clock time
**Solution**: Use shop's local time for business rules

**Issue**: Scheduled times change after DST
**Cause**: Storing local time instead of UTC
**Solution**: Store UTC, convert for display

**Issue**: Frontend showing wrong time
**Cause**: Frontend doing conversion
**Solution**: Use backend's display strings

## Performance Metrics

- **Cache Hit Rate**: >95% for shop timezones
- **Format Time**: <5ms per timestamp
- **Batch Processing**: <100ms for 100 timestamps
- **Memory Usage**: ~1MB for timezone data
- **DST Calculation**: <1ms overhead

## Future Enhancements

1. **User Preferences**: More granular user timezone settings
2. **Internationalization**: Support for more countries/timezones
3. **Calendar Integration**: iCal/Google Calendar with proper timezones
4. **Timezone Change Notifications**: Alert when shop changes timezone
5. **Historical Timezone Data**: Handle historical timezone rule changes

## Conclusion

This backend-driven timezone architecture provides:
- **Correctness**: Proper DST handling via moment-timezone
- **Simplicity**: Frontend just displays strings
- **Performance**: Cached and optimized
- **Maintainability**: Single source of truth
- **Scalability**: Easy to add new timezones
- **Reliability**: Comprehensive test coverage

The system handles all edge cases including DST transitions, various US timezones, and provides a robust foundation for timezone-aware operations throughout the application.