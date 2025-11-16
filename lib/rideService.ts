import { rideApi } from './apiClient';
import { supabase } from './supabase';

// Dynamic import for expo-location to avoid build issues
let Location: any = null;
try {
  Location = require('expo-location');
} catch (error) {
  console.log('Expo Location not available, using fallback');
}

// Create ride through server with timezone logic
export const createRideViaServer = async (rideData: {
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string; // YYYY-MM-DD
  departure_time: string; // HH:MM
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
}) => {
  try {
    console.log('🚗 Creating ride via server...');
    
    // Validate required fields
    if (!rideData.title || !rideData.departure_location || !rideData.destination_location) {
      throw new Error('Title, departure location, and destination are required');
    }
    
    if (!rideData.departure_date || !rideData.departure_time) {
      throw new Error('Departure date and time are required');
    }
    
    if (rideData.total_seats < 1 || rideData.total_seats > 8) {
      throw new Error('Total seats must be between 1 and 8');
    }
    
    if (rideData.price_per_seat < 0) {
      throw new Error('Price per seat cannot be negative');
    }
    
    // Get user's current location and timezone automatically
    let userLocation = null;
    let userTimezone = null;
    
    if (Location) {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Get current location
          const location = await Location.getCurrentPositionAsync({});
          userLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          console.log('📍 User location detected:', userLocation);
        }
      } catch (error) {
        console.log('⚠️ Could not get location:', error);
      }
    } else {
      console.log('📍 Location API not available, server will use timezone only');
    }
    
    // Get user's timezone from device
    try {
      userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 User timezone detected:', userTimezone);
    } catch (error) {
      console.log('⚠️ Could not get timezone, using fallback');
      userTimezone = 'America/New_York'; // Fallback to Eastern Time
    }
    
    // Basic validation (server will do comprehensive validation)
    const inputDateTime = new Date(`${rideData.departure_date}T${rideData.departure_time}:00`);
    if (inputDateTime <= new Date()) {
      throw new Error('Departure time must be in the future');
    }
    
    console.log('📅 User input date/time:', `${rideData.departure_date} ${rideData.departure_time}`);
    console.log('🌍 Sending to server with timezone:', userTimezone);
    
    // Prepare data for server - let server handle all timezone conversions
    const serverRideData = {
      title: rideData.title.trim(),
      departure_location: rideData.departure_location.trim(),
      destination_location: rideData.destination_location.trim(),
      departure_date: rideData.departure_date,
      departure_time: rideData.departure_time,
      total_seats: rideData.total_seats,
      price_per_seat: rideData.price_per_seat,
      description: rideData.description?.trim() || undefined,
      car_make: rideData.car_make?.trim() || undefined,
      car_model: rideData.car_model?.trim() || undefined,
      car_color: rideData.car_color?.trim() || undefined,
      car_license_plate: rideData.car_license_plate?.trim() || undefined,
      departure_latitude: rideData.departure_latitude || undefined,
      departure_longitude: rideData.departure_longitude || undefined,
      destination_latitude: rideData.destination_latitude || undefined,
      destination_longitude: rideData.destination_longitude || undefined,
      requirements: rideData.requirements?.trim() || undefined,
      // Location-aware timezone data for server processing
      user_timezone: userTimezone,
      user_location: userLocation,
    };
    
    console.log('📤 Sending ride data to server:', serverRideData);
    
    // Create ride via server
    const newRide = await rideApi.createRide(serverRideData);
    
    console.log('✅ Ride created successfully via server:', newRide);
    return newRide;
    
  } catch (error: any) {
    console.error('❌ Error creating ride via server:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to create ride. Please try again.';
    
    if (error.message) {
      if (error.message.includes('Departure time must be in the future')) {
        userMessage = 'Please select a departure time in the future.';
      } else if (error.message.includes('required')) {
        userMessage = 'Please fill in all required fields.';
      } else if (error.message.includes('seats')) {
        userMessage = 'Please enter a valid number of seats (1-8).';
      } else if (error.message.includes('price')) {
        userMessage = 'Please enter a valid price.';
      } else if (error.message.includes('Invalid timezone')) {
        userMessage = 'There was an issue with your timezone. Please try again.';
      } else if (error.message.includes('401')) {
        userMessage = 'Please sign in to create a ride.';
      } else if (error.message.includes('403')) {
        userMessage = 'You do not have permission to create rides.';
      } else if (error.message.includes('500')) {
        userMessage = 'Server error. Please try again later.';
      }
    }
    
    // Throw error with user-friendly message
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
};

// Get rides through server
export const getRidesViaServer = async (filters?: {
  departure_location?: string;
  destination?: string;
  departure_date?: string;
  min_seats?: number;
  max_price?: number;
  limit?: number;
  offset?: number;
}) => {
  try {
    const rides = await rideApi.getRides(filters);
    console.log('✅ Rides fetched via server:', rides.length, 'rides');
    return rides;
  } catch (error) {
    console.error('❌ Error fetching rides via server:', error);
    throw error;
  }
};

// Update ride through server
export const updateRideViaServer = async (rideId: string, updateData: any) => {
  try {
    const updatedRide = await rideApi.updateRide(rideId, updateData);
    console.log('✅ Ride updated successfully via server:', updatedRide);
    return updatedRide;
  } catch (error) {
    console.error('❌ Error updating ride via server:', error);
    throw error;
  }
};

// Cancel ride through server
export const cancelRideViaServer = async (rideId: string) => {
  try {
    const result = await rideApi.cancelRide(rideId);
    console.log('✅ Ride cancelled successfully via server');
    return result;
  } catch (error) {
    console.error('❌ Error cancelling ride via server:', error);
    throw error;
  }
};

// Book ride through server
export const bookRideViaServer = async (rideId: string, bookingData: {
  seats_requested: number;
  pickup_location?: string;
  notes?: string;
}) => {
  try {
    const booking = await rideApi.bookRide(rideId, bookingData);
    console.log('✅ Ride booked successfully via server:', booking);
    return booking;
  } catch (error) {
    console.error('❌ Error booking ride via server:', error);
    throw error;
  }
};

// Get user's rides through server
export const getMyRidesViaServer = async () => {
  try {
    const rides = await rideApi.getMyRides();
    console.log('✅ My rides fetched via server:', rides.length, 'rides');
    return rides;
  } catch (error) {
    console.error('❌ Error fetching my rides via server:', error);
    throw error;
  }
};

// Get user's bookings through server
export const getMyBookingsViaServer = async () => {
  try {
    const bookings = await rideApi.getMyBookings();
    console.log('✅ My bookings fetched via server:', bookings.length, 'bookings');
    return bookings;
  } catch (error) {
    console.error('❌ Error fetching my bookings via server:', error);
    throw error;
  }
};
