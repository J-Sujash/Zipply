import { supabase } from './supabase';

export interface RideStatistics {
  totalRidesAsDriver: number;
  totalRidesAsPassenger: number;
  completedRidesAsDriver: number;
  completedRidesAsPassenger: number;
  activeRidesAsDriver: number;
  activeRequestsAsPassenger: number;
}

/**
 * Get comprehensive ride statistics for a user directly from the database
 */
export const getUserRideStatistics = async (userId: string): Promise<RideStatistics> => {
  try {
    console.log('📊 Fetching ride statistics for user:', userId);

    // Get current date/time for filtering past vs future rides
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // 1. Get rides as driver statistics
    const { data: driverRides, error: driverError } = await supabase
      .from('rides')
      .select('id, status, departure_date, departure_time')
      .eq('driver_id', userId);

    if (driverError) {
      console.error('❌ Error fetching driver rides:', driverError);
      throw driverError;
    }

    // 2. Get ride requests as passenger statistics
    const { data: passengerRequests, error: passengerError } = await supabase
      .from('ride_requests')
      .select(`
        id, 
        status, 
        ride:rides!inner(
          id, 
          status, 
          departure_date, 
          departure_time
        )
      `)
      .eq('passenger_id', userId);

    if (passengerError) {
      console.error('❌ Error fetching passenger requests:', passengerError);
      throw passengerError;
    }

    // Helper function to check if a ride is in the past
    const isRidePast = (departureDate: string, departureTime: string): boolean => {
      const rideDateTime = new Date(`${departureDate}T${departureTime}`);
      return rideDateTime < now;
    };

    // Calculate driver statistics
    const totalRidesAsDriver = driverRides?.length || 0;
    const completedRidesAsDriver = driverRides?.filter((ride: any) => 
      ride.status === 'completed' || 
      (ride.status === 'active' && isRidePast(ride.departure_date, ride.departure_time))
    ).length || 0;
    const activeRidesAsDriver = driverRides?.filter((ride: any) => 
      ride.status === 'active' && !isRidePast(ride.departure_date, ride.departure_time)
    ).length || 0;

    // Calculate passenger statistics
    const approvedRequests = passengerRequests?.filter((request: any) => 
      request.status === 'approved' && 
      request.ride?.status === 'active'
    ) || [];
    
    const totalRidesAsPassenger = approvedRequests.length;
    const completedRidesAsPassenger = approvedRequests.filter((request: any) => 
      request.ride && (
        request.ride.status === 'completed' || 
        (request.ride.status === 'active' && isRidePast(request.ride.departure_date, request.ride.departure_time))
      )
    ).length;

    // Active requests (pending + approved future rides)
    const activeRequestsAsPassenger = passengerRequests?.filter((request: any) => 
      (request.status === 'pending' || 
       (request.status === 'approved' && 
        request.ride?.status === 'active' && 
        request.ride && !isRidePast(request.ride.departure_date, request.ride.departure_time)))
    ).length || 0;

    const statistics: RideStatistics = {
      totalRidesAsDriver,
      totalRidesAsPassenger,
      completedRidesAsDriver,
      completedRidesAsPassenger,
      activeRidesAsDriver,
      activeRequestsAsPassenger,
    };

    console.log('✅ Ride statistics calculated:', statistics);
    return statistics;

  } catch (error) {
    console.error('❌ Error getting ride statistics:', error);
    throw error;
  }
};

/**
 * Get simple ride counts for profile display (matches current profile interface)
 */
export const getSimpleRideStats = async (userId: string): Promise<{
  totalRidesAsDriver: number;
  totalRidesAsPassenger: number;
}> => {
  try {
    const stats = await getUserRideStatistics(userId);
    return {
      totalRidesAsDriver: stats.completedRidesAsDriver,
      totalRidesAsPassenger: stats.completedRidesAsPassenger,
    };
  } catch (error) {
    console.error('❌ Error getting simple ride stats:', error);
    // Return default values on error
    return {
      totalRidesAsDriver: 0,
      totalRidesAsPassenger: 0,
    };
  }
};
