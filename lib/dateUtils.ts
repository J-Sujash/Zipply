/**
 * Date utilities to handle timezone-safe date parsing and formatting
 * Fixes the issue where "2025-11-11" gets interpreted as UTC and shifts to previous day
 */

/**
 * Parse a date string as local date to avoid timezone issues
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export const parseLocalDate = (dateString: string): Date => {
  // Split "2025-11-11" and create local date instead of UTC
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

/**
 * Format a date string for display with Today/Tomorrow detection
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export const formatDateForDisplay = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
};

/**
 * Format a date string for display without Today/Tomorrow detection
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export const formatDateSimple = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date string for full display
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string with year
 */
export const formatDateFull = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Check if a date string represents today
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date is today
 */
export const isToday = (dateString: string): boolean => {
  const date = parseLocalDate(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Check if a date string represents tomorrow
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date is tomorrow
 */
export const isTomorrow = (dateString: string): boolean => {
  const date = parseLocalDate(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
};

/**
 * Get current date in YYYY-MM-DD format
 * @returns Current date string
 */
export const getCurrentDateString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Get tomorrow's date in YYYY-MM-DD format
 * @returns Tomorrow's date string
 */
export const getTomorrowDateString = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};
