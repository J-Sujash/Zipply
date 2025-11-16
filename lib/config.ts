/**
 * Production-ready configuration for Zipply API
 */


export const API_CONFIG = {
  // Server URL - Render deployment
  SERVER_URL: 'https://zipply-server.onrender.com',
  
  // Build timestamp to force cache refresh
  BUILD_TIME: '2025-11-15-16:18:00-PRODUCTION-RENDER-FIX',

  // Request timeouts - Optimized for speed
  TIMEOUTS: {
    SERVER_DISCOVERY: 3000,  // 3 seconds to test each server
    API_REQUEST: 10000,      // 10 seconds for API requests (more time)
    HEALTH_CHECK: 5000,      // 5 seconds for health checks
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
  },

  // API endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    RIDES: '/api/rides',
    NOTIFICATIONS: '/api/notifications',
    PROFILE: '/api/profile',
    REVIEWS: '/api/reviews',
  },

  // Cache configuration
  CACHE: {
    SERVER_URL_TTL: 300000,  // 5 minutes
    TOKEN_TTL: 300000,       // 5 minutes - cache auth tokens
    CLEAR_ON_APP_START: true,
  },

  // Authentication configuration
  AUTH: {
    TOKEN_REFRESH_THRESHOLD: 60000, // Refresh token if expires in 1 minute
    MAX_RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000,
  },

  // Development vs Production settings
  DEBUG: true,
  LOG_REQUESTS: true,
  LOG_RESPONSES: true,
  LOG_ERRORS: true,

  // Security headers
  SECURITY_HEADERS: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
};

export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  AUTH_ERROR: 'Authentication error. Please sign in again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  NO_SERVER: 'Cannot connect to server. Please check if the server is running.',
};

export const SUCCESS_MESSAGES = {
  RIDE_CREATED: 'Ride created successfully!',
  NOTIFICATION_READ: 'Notification marked as read',
  NOTIFICATIONS_CLEARED: 'All notifications cleared',
  DATA_REFRESHED: 'Data refreshed successfully',
};
