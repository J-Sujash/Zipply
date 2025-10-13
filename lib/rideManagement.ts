import { supabase } from './supabase';
import { Ride } from './supabase';
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
export const fetchUserRides = async (userId: string): Promise<Ride[]> => {
  try {
    const { data, error } = await supabase
      .from('rides')
      .select(`
        *,
        driver:profiles!rides_driver_id_fkey(
          id,
          first_name,
          last_name,
          profile_picture_url,
          rating
        )
      `)
      .eq('driver_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user rides:', error);
    throw error;
  }
};

/**
 * Update a ride
 */
export const updateRide = async (rideId: string, updateData: UpdateRideData): Promise<Ride> => {
  try {
    // First check if the ride exists and belongs to the user
    const { data: existingRide, error: fetchError } = await supabase
      .from('rides')
      .select('id, driver_id, status')
      .eq('id', rideId)
      .single();

    if (fetchError) throw fetchError;
    if (!existingRide) throw new Error('Ride not found');
    if (existingRide.status !== 'active') {
      throw new Error('Only active rides can be edited');
    }

    // Update the ride
    const { data, error } = await supabase
      .from('rides')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rideId)
      .select(`
        *,
        driver:profiles!rides_driver_id_fkey(
          id,
          first_name,
          last_name,
          profile_picture_url,
          rating
        )
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating ride:', error);
    throw error;
  }
};

/**
 * Delete a ride (soft delete by setting status to cancelled)
 */
export const deleteRide = async (rideId: string): Promise<void> => {
  try {
    // First check if the ride exists and can be deleted
    const { data: existingRide, error: fetchError } = await supabase
      .from('rides')
      .select('id, driver_id, status, available_seats, total_seats')
      .eq('id', rideId)
      .single();

    if (fetchError) throw fetchError;
    if (!existingRide) throw new Error('Ride not found');
    if (existingRide.status !== 'active') {
      throw new Error('Only active rides can be deleted');
    }

    // Check if there are any approved passengers
    const { data: approvedRequests, error: requestsError } = await supabase
      .from('ride_requests')
      .select('id')
      .eq('ride_id', rideId)
      .eq('status', 'approved');

    if (requestsError) throw requestsError;
    
    if (approvedRequests && approvedRequests.length > 0) {
      throw new Error('Cannot delete ride with approved passengers. Please contact passengers first.');
    }

    // Cancel the ride (soft delete)
    const { error: updateError } = await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rideId);

    if (updateError) throw updateError;

    // Cancel all pending requests for this ride
    const { error: cancelRequestsError } = await supabase
      .from('ride_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('ride_id', rideId)
      .eq('status', 'pending');

    if (cancelRequestsError) {
      console.error('Error cancelling pending requests:', cancelRequestsError);
      // Don't throw here as the main operation succeeded
    }

    // Send notifications to passengers about ride cancellation
    try {
      // Get ride details for notification
      const { data: rideData } = await supabase
        .from('rides')
        .select('title, driver_id')
        .eq('id', rideId)
        .single();

      if (rideData) {
        // Notify the driver
        await notifyRideCancelled(
          rideData.driver_id,
          rideData.title,
          rideId,
          true // isDriver = true
        );

        // Get all approved passengers and notify them
        const { data: passengers } = await supabase
          .from('ride_requests')
          .select('passenger_id')
          .eq('ride_id', rideId)
          .eq('status', 'approved');

        if (passengers) {
          for (const passenger of passengers) {
            await notifyRideCancelled(
              passenger.passenger_id,
              rideData.title,
              rideId,
              false // isDriver = false
            );
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
      // Don't throw here as the main operation succeeded
    }
  } catch (error) {
    console.error('Error deleting ride:', error);
    throw error;
  }
};

/**
 * Get ride requests for a specific ride
 */
export const getRideRequests = async (rideId: string) => {
  try {
    const { data, error } = await supabase
      .from('ride_requests')
      .select(`
        *,
        passenger:profiles!ride_requests_passenger_id_fkey(
          id,
          first_name,
          last_name,
          profile_picture_url,
          rating
        )
      `)
      .eq('ride_id', rideId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching ride requests:', error);
    throw error;
  }
};

/**
 * Check if a ride can be edited (no approved passengers)
 */
export const canEditRide = async (rideId: string): Promise<boolean> => {
  try {
    const { data: approvedRequests, error } = await supabase
      .from('ride_requests')
      .select('id')
      .eq('ride_id', rideId)
      .eq('status', 'approved')
      .limit(1);

    if (error) throw error;
    return !approvedRequests || approvedRequests.length === 0;
  } catch (error) {
    console.error('Error checking if ride can be edited:', error);
    return false;
  }
};
