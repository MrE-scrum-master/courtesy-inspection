/**
 * Simplified DateTime Utility
 * Following KISS principle - Frontend just displays what backend provides
 * No timezone conversion logic needed here
 */

/**
 * Simple display helper - just returns what backend provides
 */
export const displayDateTime = (backendResponse: any): string => {
  // If backend provides display string, use it
  if (backendResponse?.display) {
    return backendResponse.display;
  }
  
  // If it's a simple string, return as-is
  if (typeof backendResponse === 'string') {
    return backendResponse;
  }
  
  // Fallback
  return 'Invalid date';
};

/**
 * Get relative time from backend response
 */
export const displayRelativeTime = (backendResponse: any): string => {
  // Use backend's relative time if available
  if (backendResponse?.relative) {
    return backendResponse.relative;
  }
  
  // Otherwise use display time
  return displayDateTime(backendResponse);
};

/**
 * Smart display - shows relative for recent, full date for older
 */
export const smartDisplay = (backendResponse: any): string => {
  // If backend says it's recent, show relative
  if (backendResponse?.is_recent && backendResponse?.relative) {
    return backendResponse.relative;
  }
  
  // Otherwise show full display
  return displayDateTime(backendResponse);
};

/**
 * Display helpers for specific timestamp fields
 */
export const displayCreatedAt = (item: any): string => {
  if (item?.created_at_display) {
    return item.created_at_display;
  }
  if (item?.created_at?.display) {
    return item.created_at.display;
  }
  return displayDateTime(item?.created_at);
};

export const displayUpdatedAt = (item: any): string => {
  if (item?.updated_at_display) {
    return item.updated_at_display;
  }
  if (item?.updated_at?.display) {
    return item.updated_at.display;
  }
  return displayDateTime(item?.updated_at);
};

export const displayCompletedAt = (item: any): string => {
  if (item?.completed_at_display) {
    return item.completed_at_display;
  }
  if (item?.completed_at?.display) {
    return item.completed_at.display;
  }
  return displayDateTime(item?.completed_at);
};

/**
 * Business hours indicator
 */
export const isBusinessHours = (backendResponse: any): boolean => {
  return backendResponse?.business_context?.is_business_hours || false;
};

/**
 * Get timezone abbreviation from backend
 */
export const getTimezoneAbbr = (backendResponse: any): string => {
  return backendResponse?.timezone_abbr || backendResponse?.timezone || '';
};

/**
 * Format for inspection cards - uses backend's pre-formatted data
 */
export const formatForInspectionCard = (inspection: any): {
  primary: string;
  secondary: string;
  timezone: string;
} => {
  return {
    primary: smartDisplay(inspection.created_at),
    secondary: inspection.created_at_display || displayCreatedAt(inspection),
    timezone: inspection.created_at_timezone || ''
  };
};

/**
 * Check if we should show relative time
 */
export const shouldShowRelative = (backendResponse: any): boolean => {
  return backendResponse?.is_recent === true;
};

/**
 * Get all display formats from backend (if available)
 */
export const getAllFormats = (backendResponse: any): {
  date: string;
  time: string;
  relative: string;
  full: string;
} => {
  const formats = backendResponse?.formats || {};
  return {
    date: formats.date_only || backendResponse?.display || '',
    time: formats.time_only || '',
    relative: backendResponse?.relative || '',
    full: backendResponse?.display || ''
  };
};

/**
 * Convert user input to UTC for sending to backend
 * This is the ONLY place frontend does timezone work
 */
export const prepareForBackend = (userInput: string, inputType: 'date' | 'datetime' = 'datetime'): string => {
  try {
    // If it's already ISO format with timezone, return as-is
    if (userInput.includes('T') && (userInput.endsWith('Z') || userInput.includes('+'))) {
      return userInput;
    }
    
    // Otherwise, create a Date object and convert to ISO
    // The backend will handle the timezone conversion
    const date = new Date(userInput);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('Error preparing date for backend:', error);
    return userInput; // Send as-is and let backend handle
  }
};