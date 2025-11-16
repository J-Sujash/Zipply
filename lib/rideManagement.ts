import { rideApi, ApiRide } from './apiClient';
import { notifyRideCancelled } from './notifications';

export interface UpdateRideData {
  title?: string;
  description?: string;
  departure_location?: string;
  destination_location?: string;
  departure_date?: string;
  departure_time?: string;
  total_seats?: number;
  available_seats?: number;
  price_per_seat?: number;
  car_make?: string;
  car_model?: string;
  car_color?: string;
  car_license_plate?: string;
  requirements?: string;
}

/**
 * Fetch rides created by the current user
 */
export const fetchUserRides = async (): Promise<ApiRide[]> => {
  try {
    console.log('🚗 Fetching user rides via server...');
    const rides = await rideApi.getMyRides();
    console.log('✅ User rides fetched via server:', rides.length, 'rides');
    return rides;
  } catch (error) {
    console.error('❌ Error fetching user rides via server:', error);
    throw error;
  }
};

/**
 * Update a ride
 */
export const updateRide = async (rideId: string, updateData: UpdateRideData): Promise<ApiRide> => {
  try {
    console.log('🔄 Updating ride via server:', rideId);
    const updatedRide = await rideApi.updateRide(rideId, updateData);
    console.log('✅ Ride updated successfully via server');
    return updatedRide;
  } catch (error) {
    console.error('❌ Error updating ride via server:', error);
    throw error;
  }
};

/**
 * Delete a ride (cancel via server)
 */
export const deleteRide = async (rideId: string): Promise<void> => {
  try {
    console.log('🗑️ Cancelling ride via server:', rideId);
    await rideApi.cancelRide(rideId);
    console.log('✅ Ride cancelled successfully via server');
  } catch (error) {
    console.error('❌ Error cancelling ride via server:', error);
    throw error;
  }
};

/**
 * Get ride requests for a specific ride
 */
export const getRideRequests = async (rideId: string) => {
  try {
    console.log('📋 Fetching ride requests via server:', rideId);
    const requests = await rideApi.getRideBookings(rideId);
    console.log('✅ Ride requests fetched via server:', requests.length, 'requests');
    return requests;
  } catch (error) {
    console.error('❌ Error fetching ride requests via server:', error);
    throw error;
  }
};

/**
 * Check if a ride can be edited (simplified - let server handle validation)
 */
export const canEditRide = async (rideId: string): Promise<boolean> => {
  try {
    // For now, assume all rides can be edited and let the server validate
    // The server will return appropriate errors if the ride cannot be edited
    return true;
  } catch (error) {
    console.error('Error checking if ride can be edited:', error);
    return false;
  }
};
