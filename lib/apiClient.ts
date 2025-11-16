import { Platform } from 'react-native';
import { API_CONFIG, ERROR_MESSAGES } from './config';
import { supabase } from './supabase';

// Token caching to avoid constant session checks
let CACHED_TOKEN: string | null = null;
let TOKEN_CACHE_EXPIRY: number = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Server URL with fallback logic
const getServerUrl = (): string => {
  return API_CONFIG.SERVER_URL;
};

// Fallback URLs to try if main URL fails - Render deployment
const getFallbackUrls = (): string[] => {
  return [
    'https://zipply-server.onrender.com',  // Primary Render URL
    'https://zipply-server.onrender.com',  // Same URL as fallback
  ];
};

// Initialize API client - NOTIFICATIONS /ALL ENDPOINT FIX
console.log('🔥 NOTIFICATIONS /ALL ENDPOINT FIX - API Client reloaded for platform:', Platform.OS);
console.log('🔥 Server URL (should be machine IP):', API_CONFIG.SERVER_URL);
console.log('🔥 Fallback URLs:', getFallbackUrls());
console.log('🔥 Build time:', API_CONFIG.BUILD_TIME);
console.log('🔥 Notifications will use /notifications/all endpoint!');

// Types matching your Python server
export interface ApiRide {
  id: string;
  driver_id: string;
  driver_name?: string;
  driver_profile_picture?: string;
  driver_rating?: number;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  estimated_duration_minutes?: number;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  description?: string;
  car_make?: string;
  car_model?: string;
  car_color?: string;
  car_license_plate?: string;
  departure_latitude?: number;
  departure_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  requirements?: string;
  recurring_pattern?: string;
  recurring_end_date?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ApiBooking {
  id: string;
  ride_id: string;
  passenger_id: string;
  passenger_name?: string;
  passenger_profile_picture?: string;
  seats_booked: number;
  pickup_location?: string;
  notes?: string;
  booking_status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ApiReview {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_profile_picture?: string;
  reviewee_id: string;  // Changed to match database schema
  reviewee_name?: string;
  reviewee_profile_picture?: string;
  rating: number;
  comment?: string;
  is_driver_review: boolean;  // Changed to match database schema
  created_at: string;
}

/**
 * Check if a ride is currently ongoing (10 minutes before to 30 minutes after departure time)
 */
export const isRideOngoing = (departureDate: string, departureTime: string): boolean => {
  try {
    const now = new Date();
    const [year, month, day] = departureDate.split('-').map(Number);
    const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
    const rideStart = new Date(year, month - 1, day, hours, minutes, seconds);
    
    // Calculate time window: 10 minutes before to 30 minutes after
    const startWindow = new Date(rideStart.getTime() - 10 * 60 * 1000); // 10 min before
    const endWindow = new Date(rideStart.getTime() + 30 * 60 * 1000); // 30 min after
    
    return now >= startWindow && now <= endWindow;
  } catch (error) {
    console.error('Error checking if ride is ongoing:', error);
    return false;
  }
};

export interface OngoingRide {
  id: string;
  title: string;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  userRole: 'driver' | 'passenger';
  driverName?: string;
  passengerCount?: number;
  totalSeats?: number;
  vehicle?: {
    make: string;
    model: string;
    color: string;
    licensePlate: string;
  };
}

export interface RideRequest {
  id: string;
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  seats_requested: number;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  created_at: string;
  ride: {
    id: string;
    title: string;
    departure_location: string;
    destination_location: string;
    departure_date: string;
    departure_time: string;
    price_per_seat: number;
    available_seats: number;
    total_seats: number;
  };
}

// Get auth token from Supabase session
const getAuthToken = async (): Promise<string | null> => {
  try {
    // Check if we have a valid cached token
    const now = Date.now();
    if (CACHED_TOKEN && now < TOKEN_CACHE_EXPIRY) {
      return CACHED_TOKEN;
    }
    
    // Get fresh token from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      if (__DEV__) {
        console.error('🔑 AUTH ERROR: Failed to get session');
      }
      return null;
    }
    
    if (!session || !session.user) {
      if (__DEV__) {
        console.warn('🔑 AUTH WARNING: No valid session found');
      }
      return null;
    }
    
    const token = session?.access_token || null;
    
    if (token) {
      // Cache the token if we got one
      CACHED_TOKEN = token;
      TOKEN_CACHE_EXPIRY = now + TOKEN_CACHE_DURATION;
    } else {
      if (__DEV__) {
        console.error('🔑 AUTH ERROR: Session exists but no access_token found');
      }
      // Clear cache if no token
      CACHED_TOKEN = null;
      TOKEN_CACHE_EXPIRY = 0;
    }
    
    return token;
  } catch (error) {
    console.error('🔑 AUTH CRITICAL ERROR: Exception getting auth token:', error);
    // Clear cache on error
    CACHED_TOKEN = null;
    TOKEN_CACHE_EXPIRY = 0;
    return null;
  }
};

// Clear token cache (call when user signs out)
const clearTokenCache = () => {
  CACHED_TOKEN = null;
  TOKEN_CACHE_EXPIRY = 0;
};


// Check if endpoint requires authentication
const requiresAuth = (endpoint: string): boolean => {
  const publicEndpoints = [
    '/health',
    '/notifications/test',
    '/notifications/debug', 
    '/notifications/simple',
    '/notifications/all',        // SERVICE ROLE: No auth required
    '/notifications/create',     // SERVICE ROLE: No auth required
    '/notifications/unread-count', // SERVICE ROLE: No auth required
    '/rides/search',             // SERVICE ROLE: No auth required
    '/conversations/health'      // SERVICE ROLE: No auth required
  ];
  
  // Remove /api prefix for comparison
  const cleanEndpoint = endpoint.replace('/api', '');
  return !publicEndpoints.includes(cleanEndpoint);
};

// ROBUST API REQUEST WITH SMART AUTHENTICATION AND FALLBACK
const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const primaryUrl = getServerUrl();
  const fallbackUrls = getFallbackUrls();
  const urlsToTry = [primaryUrl, ...fallbackUrls.filter(url => url !== primaryUrl)];
  
  let lastError: Error | null = null;
  
  for (const serverUrl of urlsToTry) {
    const fullUrl = `${serverUrl}${endpoint}`;
    
    // Only log in development mode and sanitize sensitive info
    if (__DEV__) {
      console.log(`🌐 API REQUEST: ${options.method || 'GET'} ${endpoint.replace(/\/[a-f0-9-]{36}/g, '/[USER_ID]')}`);
    }
    
    try {
      const headers: Record<string, string> = {
        ...API_CONFIG.SECURITY_HEADERS,
        ...(options.headers as Record<string, string>),
      };

      // Only get auth token for endpoints that require it
      if (requiresAuth(endpoint)) {
        const token = await getAuthToken();
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          if (__DEV__) {
            console.log(`🔐 AUTH TOKEN ADDED`);
          }
        } else {
          console.error(`🔐 AUTH FAILED: No token available`);
          throw new Error('Authentication required. Please sign in.');
        }
      }

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUTS.API_REQUEST);

      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (API_CONFIG.LOG_ERRORS) {
          console.error(`Server error ${response.status}: ${errorText}`);
        }
        
        if (response.status === 404) {
          throw new Error(`Endpoint not found: ${endpoint}`);
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        } else {
          throw new Error(`Request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      if (API_CONFIG.LOG_RESPONSES && __DEV__) {
        console.log(`API Success: ${endpoint.replace(/\/[a-f0-9-]{36}/g, '/[USER_ID]')}`);
      }
      return data;
      
    } catch (error: any) {
      if (API_CONFIG.LOG_ERRORS && serverUrl === urlsToTry[urlsToTry.length - 1]) {
        console.log(`Connection failed: ${error.message}`);
      }
      lastError = error;
      
      // If this is not the last URL, continue to next one
      if (serverUrl !== urlsToTry[urlsToTry.length - 1]) {
        continue;
      }
    }
  }
  
  // If we get here, all URLs failed
  if (lastError) {
    if (API_CONFIG.LOG_ERRORS) {
      console.error(`Request failed for ${endpoint}: ${lastError.message}`);
    }
    
    if (lastError.name === 'AbortError') {
      throw new Error(ERROR_MESSAGES.TIMEOUT);
    } else if (lastError.message.includes('Network request failed')) {
      throw new Error(ERROR_MESSAGES.NO_SERVER);
    } else if (lastError.message.includes('fetch')) {
      throw new Error(ERROR_MESSAGES.NETWORK);
    } else {
      throw new Error(lastError.message || ERROR_MESSAGES.UNKNOWN_ERROR);
    }
  }
  
  throw new Error(ERROR_MESSAGES.NO_SERVER);
};

// Ride API functions
export const rideApi = {
  // Create a new ride - Optimized for new server format
  createRide: async (rideData: {
    title: string;
    departure_location: string;
    destination_location: string;
    departure_date: string;     // YYYY-MM-DD format
    departure_time: string;     // HH:MM:SS format
    total_seats: number;
    price_per_seat: number;
    description?: string;
    car_make?: string;
    car_model?: string;
    car_color?: string;
    car_license_plate?: string;
    departure_latitude?: number;
    departure_longitude?: number;
    destination_latitude?: number;
    destination_longitude?: number;
    requirements?: string;
    user_timezone?: string;    // Optional, defaults to America/New_York
    user_location?: any;        // Optional location data
  }): Promise<{success: boolean; ride: ApiRide}> => {
    if (API_CONFIG.LOG_REQUESTS) {
      console.log('🚗 Creating ride via optimized API:', rideData);
    }
    
    // Validate required fields
    if (!rideData.title?.trim()) {
      throw new Error('Ride title is required');
    }
    if (!rideData.departure_location?.trim()) {
      throw new Error('Departure location is required');
    }
    if (!rideData.destination_location?.trim()) {
      throw new Error('Destination location is required');
    }
    if (!rideData.departure_date) {
      throw new Error('Departure date is required');
    }
    if (!rideData.departure_time) {
      throw new Error('Departure time is required');
    }
    if (rideData.total_seats < 1 || rideData.total_seats > 8) {
      throw new Error('Total seats must be between 1 and 8');
    }
    if (rideData.price_per_seat < 0) {
      throw new Error('Price per seat cannot be negative');
    }
    
    return apiRequest<{success: boolean; ride: ApiRide}>('/api/rides/create', {
      method: 'POST',
      body: JSON.stringify(rideData),
    });
  },

  // Get rides with filters
  getRides: async (filters: {
    departure_location?: string;
    destination?: string;
    departure_date?: string;
    min_seats?: number;
    max_price?: number;
    departure_latitude?: number;
    departure_longitude?: number;
    destination_latitude?: number;
    destination_longitude?: number;
    radius_km?: number;
    status?: string;
    limit?: number;
    offset?: number;
    exclude_own_rides?: boolean;
  } = {}): Promise<ApiRide[]> => {
    const queryParams = new URLSearchParams();
    
    // Add filters to query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/api/rides/search${queryString ? `?${queryString}` : ''}`;
    console.log('⚡ FAST SEARCH: Using service role endpoint (bypasses RLS):', endpoint);
    console.log('⚡ FAST SEARCH: Should load much faster than anon client');
    return apiRequest<ApiRide[]>(endpoint);
  },

  // Get ongoing rides (10 min before to 30 min after departure time)
  getOngoingRides: async (): Promise<OngoingRide[]> => {
    return apiRequest<OngoingRide[]>('/api/rides/ongoing');
  },

  // Request to join a ride
  requestRide: async (rideId: string, seatsRequested: number = 1): Promise<{
    message: string;
    request_id: string;
    seats_requested: number;
    status: string;
  }> => {
    const endpoint = `/api/rides/${rideId}/request?seats_requested=${seatsRequested}`;
    console.log('🎫 RIDE REQUEST: Requesting seats for ride:', rideId);
    return apiRequest(endpoint, { method: 'POST' });
  },

  // Check if user has requested a specific ride
  checkRequestStatus: async (rideId: string): Promise<{
    has_requested: boolean;
    request_id: string | null;
    status: string | null;
    seats_requested: number;
    created_at: string | null;
  }> => {
    const endpoint = `/api/rides/${rideId}/request-status`;
    console.log('🔍 CHECKING REQUEST STATUS: For ride:', rideId);
    return apiRequest(endpoint);
  },

  // Approve a ride request (for drivers) - FIXED ENDPOINT
  approveRequest: async (requestId: string): Promise<{
    message: string;
    success: boolean;
    available_seats: number;
  }> => {
    const endpoint = `/api/rides/requests/${requestId}/approve`;
    console.log('✅ APPROVE REQUEST: Approving request:', requestId);
    return apiRequest(endpoint, { method: 'POST' });
  },

  // Reject a ride request (for drivers)
  rejectRequest: async (requestId: string): Promise<{
    message: string;
    success: boolean;
  }> => {
    const endpoint = `/api/rides/requests/${requestId}/reject`;
    console.log('❌ REJECT REQUEST: Rejecting request:', requestId);
    return apiRequest(endpoint, { method: 'POST' });
  },

  // Leave a ride (for approved passengers)
  leaveRide: async (requestId: string): Promise<{
    message: string;
    success: boolean;
    available_seats: number;
  }> => {
    const endpoint = `/api/rides/requests/${requestId}/leave`;
    console.log('🚪 LEAVE RIDE: Leaving ride for request:', requestId);
    return apiRequest(endpoint, { method: 'POST' });
  },

  // Get specific ride
  getRide: async (rideId: string): Promise<ApiRide> => {
    return apiRequest<ApiRide>(`/api/rides/${rideId}`);
  },

  // Update ride
  updateRide: async (rideId: string, updateData: Partial<ApiRide>): Promise<ApiRide> => {
    return apiRequest<ApiRide>(`/api/rides/${rideId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Cancel ride
  cancelRide: async (rideId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/rides/${rideId}`, {
      method: 'DELETE',
    });
  },

  // Book a ride
  bookRide: async (rideId: string, bookingData: {
    seats_requested: number;
    pickup_location?: string;
    notes?: string;
  }): Promise<ApiBooking> => {
    return apiRequest<ApiBooking>(`/api/rides/${rideId}/book`, {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId, ...bookingData }),
    });
  },

  // Get ride bookings (for drivers)
  getRideBookings: async (rideId: string): Promise<ApiBooking[]> => {
    return apiRequest<ApiBooking[]>(`/api/rides/${rideId}/bookings`);
  },

  // Update booking
  updateBooking: async (bookingId: string, updateData: {
    seats_requested?: number;
    pickup_location?: string;
    notes?: string;
    booking_status?: string;
  }): Promise<ApiBooking> => {
    return apiRequest<ApiBooking>(`/api/rides/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Cancel booking
  cancelBooking: async (bookingId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/rides/bookings/${bookingId}`, {
      method: 'DELETE',
    });
  },

  // Get user's rides
  getMyRides: async (status?: string, limit = 20, offset = 0): Promise<ApiRide[]> => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (status) params.append('status', status);
    return apiRequest<ApiRide[]>(`/api/rides/user/my-rides?${params.toString()}`);
  },

  // Get user's bookings
  getMyBookings: async (status?: string, limit = 20, offset = 0): Promise<ApiBooking[]> => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (status) params.append('status', status);
    return apiRequest<ApiBooking[]>(`/api/rides/user/my-bookings?${params.toString()}`);
  },

  // Get incoming requests for user's rides (for drivers)
  getIncomingRequests: async (): Promise<RideRequest[]> => {
    console.log('📥 Getting incoming requests for my rides...');
    return apiRequest<RideRequest[]>('/api/rides/user/incoming-requests');
  },

  // Get my ride requests (as passenger)
  getMyRequests: async (): Promise<RideRequest[]> => {
    console.log('🎫 Getting my ride requests...');
    return apiRequest<RideRequest[]>('/api/rides/user/my-requests');
  },

  // Test endpoint to verify server connectivity
  testUserEndpoints: async (): Promise<{message: string; user_id: string; timestamp: string}> => {
    console.log('🧪 Testing user endpoints...');
    return apiRequest('/api/rides/user/test');
  },
};


// Review API functions
export const reviewApi = {
  // Create a review
  createReview: async (reviewData: {
    ride_id: string;
    reviewee_id: string;  // Changed to match database schema
    rating: number;
    comment?: string;
    is_driver_review: boolean;  // Changed to match database schema
  }): Promise<ApiReview> => {
    return apiRequest<ApiReview>('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },

  // Get reviews with filters
  getReviews: async (filters: {
    ride_id?: string;
    reviewer_id?: string;
    reviewee_id?: string;  // Changed to match database schema
    is_driver_review?: boolean;  // Changed to match database schema
    min_rating?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiReview[]> => {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const queryString = queryParams.toString();
    return apiRequest<ApiReview[]>(`/reviews${queryString ? `?${queryString}` : ''}`);
  },

  // Get specific review
  getReview: async (reviewId: string): Promise<ApiReview> => {
    return apiRequest<ApiReview>(`/reviews/${reviewId}`);
  },

  // Update review
  updateReview: async (reviewId: string, updateData: {
    rating?: number;
    comment?: string;
  }): Promise<ApiReview> => {
    return apiRequest<ApiReview>(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Delete review
  deleteReview: async (reviewId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  },

  // Get user review stats
  getUserReviewStats: async (userId: string) => {
    return apiRequest(`/reviews/user/${userId}/stats`);
  },

  // Get ride review summary
  getRideReviewSummary: async (rideId: string) => {
    return apiRequest(`/reviews/ride/${rideId}/summary`);
  },

  // Get my reviews
  getMyReviews: async (asReviewer = true, limit = 20, offset = 0): Promise<ApiReview[]> => {
    const params = new URLSearchParams({
      as_reviewer: asReviewer.toString(),
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return apiRequest<ApiReview[]>(`/reviews/user/my-reviews?${params.toString()}`);
  },

  // Check if a ride is eligible for rating (48-hour window)
  checkRideEligibility: async (rideId: string): Promise<{ isEligible: boolean; reason?: string }> => {
    return apiRequest<{ isEligible: boolean; reason?: string }>(`/reviews/ride/${rideId}/eligibility`);
  },

  // Get eligible users to rate for a specific ride
  getEligibleUsersToRate: async (rideId: string): Promise<{
    user_id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
    role: 'driver' | 'passenger';
    already_rated: boolean;
  }[]> => {
    return apiRequest(`/reviews/ride/${rideId}/eligible-users`);
  },

  // Get eligible rides for rating (within 48-hour window)
  getEligibleRidesForRating: async (): Promise<{
    id: string;
    title: string;
    departure_location: string;
    destination_location: string;
    departure_date: string;
    departure_time: string;
    unratedCount: number;
  }[]> => {
    return apiRequest('/reviews/eligible-rides');
  },

  // Submit rating with server-side validation
  submitRating: async (ratingData: {
    ride_id: string;
    reviewee_id: string;  // Changed to match database schema
    rating: number;
    comment?: string;
    is_driver_review: boolean;  // Changed to match database schema
  }): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/reviews/submit', {
      method: 'POST',
      body: JSON.stringify(ratingData),
    });
  },

  // Submit multiple ratings with server-side validation
  submitMultipleRatings: async (ratings: {
    ride_id: string;
    reviewee_id: string;  // Changed to match database schema
    rating: number;
    comment?: string;
    is_driver_review: boolean;  // Changed to match database schema
  }[]): Promise<{ success: boolean; message: string; results: any[] }> => {
    return apiRequest('/reviews/submit-multiple', {
      method: 'POST',
      body: JSON.stringify({ ratings }),
    });
  },
};

// Profile API functions
export const profileApi = {
  // Get current user's profile
  getProfile: async () => {
    return apiRequest('/api/profile');
  },

  // Update current user's profile
  updateProfile: async (profileData: {
    full_name?: string;
    phone?: string;
    college?: string;
    year?: string;
    profile_picture?: string;
  }) => {
    return apiRequest('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // Get public user profile
  getUserProfile: async (userId: string) => {
    return apiRequest(`/api/profile/${userId}`);
  },
};

// Statistics API functions
export const statsApi = {
  // Get overall ride statistics
  getRideStats: async () => {
    return apiRequest('/api/stats/rides');
  },

  // Get user statistics
  getUserStats: async (userId: string) => {
    return apiRequest(`/api/stats/user/${userId}`);
  },

  // Get current user statistics
  getMyStats: async () => {
    return apiRequest('/api/stats/my-stats');
  },
};

// Search API functions
export const searchApi = {
  // Search locations
  searchLocations: async (query: string) => {
    return apiRequest(`/api/search/locations?q=${encodeURIComponent(query)}`);
  },

  // Search users
  searchUsers: async (query: string, limit = 10) => {
    return apiRequest(`/api/search/users?q=${encodeURIComponent(query)}&limit=${limit}`);
  },
};

// Messaging API types
export interface ApiConversation {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  // Joined data
  ride?: {
    departure_location: string;
    destination_location: string;
    departure_time: string;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  passenger?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
    message_type: string;
  };
  unread_count?: number;
}

export interface ApiMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system' | 'location';
  is_read: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
}

// Messaging API functions - SUPER FAST & EFFICIENT
export const messagingApi = {
  // Get conversations INSTANTLY - Like WhatsApp/Telegram
  getConversations: async (): Promise<any[]> => {
    console.log('🚀 FAST: Getting conversations instantly...');
    return apiRequest<any[]>('/api/conversations/simple');
  },

  // Get messages INSTANTLY - Like WhatsApp/Telegram  
  getMessages: async (conversationId: string): Promise<any[]> => {
    console.log(`🚀 FAST: Getting messages for ${conversationId} instantly...`);
    return apiRequest<any[]>(`/api/conversations/${conversationId}/messages/simple`);
  },

  // Send message INSTANTLY - Like WhatsApp/Telegram
  sendMessage: async (conversationId: string, content: string, messageType = 'text', replyToMessageId?: string): Promise<any> => {
    console.log(`🚀 FAST: Sending message to ${conversationId} instantly...`);
    console.log(`🚀 FAST: Message content: "${content}"`);
    if (replyToMessageId) {
      console.log(`🚀 FAST: Reply to message: ${replyToMessageId}`);
    }
    
    // Try the simple endpoint first
    try {
      const requestBody: any = { content };
      if (replyToMessageId) {
        requestBody.reply_to_message_id = replyToMessageId;
      }
      
      const result = await apiRequest(`/api/conversations/${conversationId}/messages/simple`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      console.log(`🚀 SIMPLE SEND SUCCESS:`, result);
      return result;
    } catch (error) {
      console.log(`⚠️ Simple send failed, trying fast endpoint:`, error);
      
      // Fallback to fast endpoint
      const requestBody: any = { content, message_type: messageType };
      if (replyToMessageId) {
        requestBody.reply_to_message_id = replyToMessageId;
      }
      
      return apiRequest(`/api/conversations/${conversationId}/messages/fast`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    }
  },

  // Legacy methods for compatibility
  getConversationMessages: async (conversationId: string): Promise<ApiMessage[]> => {
    return apiRequest<ApiMessage[]>(`/api/conversations/${conversationId}/messages`);
  },

  sendMessageLegacy: async (conversationId: string, messageData: {
    content: string;
    message_type?: 'text' | 'system' | 'location';
  }): Promise<ApiMessage> => {
    return apiRequest<ApiMessage>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  },

  // Mark messages as read in a conversation
  markMessagesAsRead: async (conversationId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/api/conversations/${conversationId}/mark-read`, {
      method: 'PUT',
    });
  },

  // Get or create a conversation between driver and passenger for a ride
  getOrCreateConversation: async (conversationData: {
    ride_id: string;
    driver_id: string;
    passenger_id: string;
  }): Promise<{ conversation_id: string }> => {
    return apiRequest<{ conversation_id: string }>('/api/conversations/get-or-create', {
      method: 'POST',
      body: JSON.stringify(conversationData),
    });
  },

  // Get total unread message count for current user - FAST & RESPONSIVE
  getUnreadMessageCount: async (): Promise<{ count: number }> => {
    console.log('📊 Getting unread message count...');
    return apiRequest<{ count: number }>('/api/conversations/unread-count');
  },

  // Health check for messaging system
  healthCheck: async (): Promise<any> => {
    console.log('🏥 Checking messaging health...');
    return apiRequest('/api/conversations/health');
  },

  // Hide conversation for current user only (soft delete)
  hideConversation: async (conversationId: string): Promise<{ success: boolean }> => {
    console.log(`🗑️ Hiding conversation ${conversationId} for current user...`);
    return apiRequest<{ success: boolean }>(`/api/conversations/${conversationId}/hide`, {
      method: 'PUT',
    });
  },

  // Check if messaging is disabled for a ride (45+ minutes after start)
  checkMessagingStatus: async (rideId: string): Promise<{
    ride_id: string;
    messaging_disabled: boolean;
    reason?: string;
  }> => {
    console.log(`🔍 Checking messaging status for ride ${rideId}...`);
    return apiRequest(`/api/conversations/messaging-status/${rideId}`);
  },

  // Cleanup endpoints for admin/testing
  autoCleanupExpiredMessages: async (): Promise<{
    deleted_messages_count: number;
    deleted_conversations_count: number;
    processed_rides_count: number;
  }> => {
    console.log('🧹 Triggering automatic cleanup of expired messages...');
    return apiRequest('/api/conversations/cleanup/auto', {
      method: 'POST',
    });
  },

  cleanupRideMessages: async (rideId: string): Promise<{
    success: boolean;
    ride_id: string;
    ride_title: string;
    deleted_messages: number;
    deleted_conversations: number;
    error?: string;
  }> => {
    console.log(`🧹 Cleaning up messages for ride ${rideId}...`);
    return apiRequest(`/api/conversations/cleanup/ride/${rideId}`, {
      method: 'POST',
    });
  },
};

// Notification API types
export interface ApiNotification {
  id: string;
  user_id: string;
  type: 'ride_request' | 'request_approved' | 'request_rejected' | 'ride_cancelled' | 'ride_reminder' | 'ride_created' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  related_ride_id?: string;
  related_request_id?: string;
  created_at: string;
}

// Notification API functions
export const notificationApi = {
  // Get all notifications for current user
  getNotifications: async (filters: {
    is_read?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiNotification[]> => {
    // Get user ID from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔥 API CLIENT: Using real user ID:', userId);
    
    const queryParams = new URLSearchParams();
    queryParams.append('user_id', userId);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/api/notifications/all?${queryString}`;
    console.log('⚡ FAST NOTIFICATIONS: Using service role endpoint (bypasses RLS):', endpoint);
    console.log('⚡ FAST NOTIFICATIONS: No JWT auth required - should load instantly');
    // Use service role endpoint - no JWT auth required, passes user_id as parameter
    return apiRequest<ApiNotification[]>(endpoint);
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Mark all notifications as read
  markAllAsRead: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/notifications/mark-all-read', {
      method: 'PUT',
    });
  },

  // Approve ride request - DIRECT DATABASE (BYPASS BROKEN SERVER)
  approveRequest: async (requestId: string): Promise<{
    message: string;
    seats_booked: number;
    available_seats: number;
    total_seats: number;
    success: boolean;
  }> => {
    console.log('🔥 DIRECT DATABASE: Approving request bypassing server:', requestId);
    throw new Error('USE DIRECT DATABASE APPROACH IN FRONTEND - SERVER IS BROKEN');
  },

  // Reject ride request
  rejectRequest: async (requestId: string): Promise<{
    message: string;
    success: boolean;
  }> => {
    console.log('❌ API: Rejecting request via server endpoint:', requestId);
    return apiRequest(`/api/rides/requests/${requestId}/reject`, {
      method: 'POST',
    });
  },

  // Delete notification
  deleteNotification: async (notificationId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  // Delete multiple notifications
  deleteNotifications: async (notificationIds: string[]): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/notifications/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({ notification_ids: notificationIds }),
    });
  },

  // Clear all notifications
  clearAllNotifications: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/notifications/clear-all', {
      method: 'DELETE',
    });
  },

  // Send a test push notification to the current user
  sendTestPushNotification: async (): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>('/api/push-notifications/test', {
      method: 'POST',
    });
  },

  // Get unread count
  getUnreadCount: async (): Promise<{ count: number }> => {
    // Get user ID from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    if (__DEV__) {
      console.log('🔥 SERVICE ROLE: Getting unread count');
    }
    return apiRequest<{ count: number }>(`/api/notifications/unread-count?user_id=${userId}`);
  },

  // Create notification (for system use)
  createNotification: async (notificationData: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    related_ride_id?: string;
    related_request_id?: string;
  }): Promise<ApiNotification> => {
    console.log('🔔 CREATING NOTIFICATION: Via service role endpoint');
    // Use the service role endpoint that doesn't require JWT auth
    return apiRequest<ApiNotification>('/api/notifications/create', {
      method: 'POST',
      body: JSON.stringify(notificationData),
    });
  },
};

// Live Ride Tracking API
export interface LiveRide {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  status: string;
  driver_id: string;
  driver_name: string;
  driver_profile_picture?: string;
  driver_phone?: string;
  vehicle?: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    license_plate?: string;
  };
  current_latitude?: number;
  current_longitude?: number;
  estimated_arrival?: string;
  started_at?: string;
  passengers: Array<{
    passenger: {
      first_name: string;
      last_name: string;
      profile_picture_url?: string;
    };
    seats_requested: number;
    status: string;
  }>;
  user_role: 'driver' | 'passenger';
}

export interface LiveRideUpdate {
  ride_id: string;
  status?: string;
  current_latitude?: number;
  current_longitude?: number;
  estimated_arrival?: string;
}

export const liveRideApi = {
  async getUserLiveRides(userId: string): Promise<{ live_rides: LiveRide[] }> {
    if (__DEV__) {
      console.log('🔴 Getting live rides for user');
    }
    return apiRequest<{ live_rides: LiveRide[] }>(`/api/rides/live/${userId}`);
  },

  async startRide(rideId: string): Promise<{ message: string; started_at: string }> {
    if (__DEV__) {
      console.log('🚀 Starting ride:', rideId);
    }
    return apiRequest<{ message: string; started_at: string }>(`/api/rides/${rideId}/start`, {
      method: 'POST',
    });
  },

  async updateRideLocation(rideId: string, updateData: LiveRideUpdate): Promise<{ message: string }> {
    if (__DEV__) {
      console.log('📍 Updating ride location:', rideId);
    }
    return apiRequest<{ message: string }>(`/api/rides/${rideId}/update-location`, {
      method: 'POST',
      body: JSON.stringify(updateData),
    });
  },

  async completeRide(rideId: string): Promise<{ message: string; completed_at: string }> {
    if (__DEV__) {
      console.log('🏁 Completing ride:', rideId);
    }
    return apiRequest<{ message: string; completed_at: string }>(`/api/rides/${rideId}/complete`, {
      method: 'POST',
    });
  }
};

// Simple test function
export const testServerConnection = async (): Promise<boolean> => {
  try {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/health`);
    return response.ok;
  } catch (error: any) {
    if (API_CONFIG.LOG_ERRORS) {
      console.log(`Health check failed: ${error.message}`);
    }
    return false;
  }
};

export default {
  rides: rideApi,
  reviews: reviewApi,
  profile: profileApi,
  stats: statsApi,
  search: searchApi,
  notifications: notificationApi,
  liveRides: liveRideApi,
  messaging: messagingApi,
  clearTokenCache, // Export for use when user signs out
};
