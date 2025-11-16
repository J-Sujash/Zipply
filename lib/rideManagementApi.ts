import { rideApi, reviewApi, ApiRide, ApiBooking, ApiReview } from './apiClient';

// Updated ride management functions to use API instead of direct Supabase
export interface UpdateRideData {
  departure_location?: string;
  destination?: string;
  departure_time?: string;
  available_seats?: number;
  price_per_seat?: number;
  description?: string;
  car_model?: string;
  license_plate?: string;
  departure_latitude?: number;
  departure_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}

/**
 * Fetch rides created by the current user
 */
export const fetchUserRides = async (): Promise<ApiRide[]> => {
  try {
    return await rideApi.getMyRides();
  } catch (error) {
    console.error('Error fetching user rides:', error);
    throw error;
  }
};

/**
 * Create a new ride
 */
export const createRide = async (rideData: {
  departure_location: string;
  destination: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  description?: string;
  car_model?: string;
  license_plate?: string;
  departure_latitude?: number;
  departure_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}): Promise<ApiRide> => {
  try {
    // Parse the departure_time to separate date and time
    const departureDateTime = new Date(rideData.departure_time);
    const departure_date = departureDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const departure_time = departureDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
    
    // Map the data to the expected API format
    const apiRideData = {
      title: `${rideData.departure_location} to ${rideData.destination}`,
      departure_location: rideData.departure_location,
      destination_location: rideData.destination,
      departure_date: departure_date,
      departure_time: departure_time,
      total_seats: rideData.available_seats,
      price_per_seat: rideData.price_per_seat,
      description: rideData.description,
      car_make: rideData.car_model,
      car_license_plate: rideData.license_plate,
      departure_latitude: rideData.departure_latitude,
      departure_longitude: rideData.departure_longitude,
      destination_latitude: rideData.destination_latitude,
      destination_longitude: rideData.destination_longitude,
    };
    
    // The API returns {success: boolean; ride: ApiRide}, so we need to extract the ride
    const response = await rideApi.createRide(apiRideData);
    return response.ride;
  } catch (error) {
    console.error('Error creating ride:', error);
    throw error;
  }
};

/**
 * Update a ride
 */
export const updateRide = async (rideId: string, updateData: UpdateRideData): Promise<ApiRide> => {
  try {
    return await rideApi.updateRide(rideId, updateData);
  } catch (error) {
    console.error('Error updating ride:', error);
    throw error;
  }
};

/**
 * Cancel a ride
 */
export const deleteRide = async (rideId: string): Promise<void> => {
  try {
    await rideApi.cancelRide(rideId);
  } catch (error) {
    console.error('Error cancelling ride:', error);
    throw error;
  }
};

/**
 * Search for rides
 */
export const searchRides = async (filters: {
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
}): Promise<ApiRide[]> => {
  try {
    return await rideApi.getRides(filters);
  } catch (error) {
    console.error('Error searching rides:', error);
    throw error;
  }
};

/**
 * Book a ride
 */
export const bookRide = async (rideId: string, bookingData: {
  seats_requested: number;
  pickup_location?: string;
  notes?: string;
}): Promise<ApiBooking> => {
  try {
    return await rideApi.bookRide(rideId, bookingData);
  } catch (error) {
    console.error('Error booking ride:', error);
    throw error;
  }
};

/**
 * Get user's bookings
 */
export const fetchUserBookings = async (): Promise<ApiBooking[]> => {
  try {
    return await rideApi.getMyBookings();
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    throw error;
  }
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (bookingId: string): Promise<void> => {
  try {
    await rideApi.cancelBooking(bookingId);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
};

/**
 * Check if ride can be edited (business logic)
 */
export const canEditRide = (ride: ApiRide): boolean => {
  if (ride.status !== 'active') return false;
  
  const departureTime = new Date(ride.departure_time);
  const now = new Date();
  const timeDiff = departureTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Can edit if departure is more than 2 hours away
  return hoursDiff > 2;
};

/**
 * Check if ride can be cancelled
 */
export const canCancelRide = (ride: ApiRide): boolean => {
  if (ride.status !== 'active') return false;
  
  const departureTime = new Date(ride.departure_time);
  const now = new Date();
  const timeDiff = departureTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Can cancel if departure is more than 1 hour away
  return hoursDiff > 1;
};
