import { rideApi, searchApi , ApiRide } from './apiClient';

// Search and filter interface
export interface RideSearchFilters {
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
  status?: 'active' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}

// Search rides through server
export const searchRidesViaServer = async (filters: RideSearchFilters = {}): Promise<ApiRide[]> => {
  try {
    console.log('🔍 Searching rides via server with filters:', filters);
    
    // Default to active rides if no status specified
    const searchFilters = {
      status: 'active',
      limit: 20,
      offset: 0,
      ...filters
    };
    
    console.log('📤 Sending request with filters:', searchFilters);
    
    const rides = await rideApi.getRides(searchFilters);
    
    console.log('✅ Found', rides.length, 'rides via server');
    console.log('📊 Sample ride data:', rides[0] || 'No rides returned');
    return rides;
    
  } catch (error) {
    console.error('❌ Error searching rides via server:', error);
    console.error('❌ Error details:', error);
    throw error;
  }
};

// Get all active rides
export const getActiveRidesViaServer = async (limit: number = 20, offset: number = 0): Promise<ApiRide[]> => {
  return searchRidesViaServer({
    status: 'active',
    limit,
    offset
  });
};

// Search rides by location
export const searchRidesByLocationViaServer = async (
  departureLocation?: string,
  destination?: string,
  limit: number = 20
): Promise<ApiRide[]> => {
  return searchRidesViaServer({
    departure_location: departureLocation,
    destination: destination,
    status: 'active',
    limit
  });
};

// Search rides by date
export const searchRidesByDateViaServer = async (
  date: string, // YYYY-MM-DD format
  limit: number = 20
): Promise<ApiRide[]> => {
  return searchRidesViaServer({
    departure_date: date,
    status: 'active',
    limit
  });
};

// Search rides by location and date
export const searchRidesByLocationAndDateViaServer = async (
  departureLocation?: string,
  destination?: string,
  date?: string,
  minSeats?: number,
  maxPrice?: number,
  limit: number = 20
): Promise<ApiRide[]> => {
  return searchRidesViaServer({
    departure_location: departureLocation,
    destination: destination,
    departure_date: date,
    min_seats: minSeats,
    max_price: maxPrice,
    status: 'active',
    limit
  });
};

// Search rides near coordinates
export const searchRidesNearLocationViaServer = async (
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  limit: number = 20
): Promise<ApiRide[]> => {
  return searchRidesViaServer({
    departure_latitude: latitude,
    departure_longitude: longitude,
    radius_km: radiusKm,
    status: 'active',
    limit
  });
};

// Search locations (for autocomplete)
export const searchLocationsViaServer = async (query: string): Promise<string[]> => {
  try {
    if (query.length < 2) {
      return [];
    }
    
    console.log('🔍 Searching locations via server:', query);
    
    const result = await searchApi.searchLocations(query);
    const locations = (result as any).locations || [];
    
    console.log('✅ Found', locations.length, 'locations via server');
    return locations;
    
  } catch (error) {
    console.error('❌ Error searching locations via server:', error);
    return [];
  }
};

// Get popular routes (most common departure/destination pairs)
export const getPopularRoutesViaServer = async (): Promise<{departure: string, destination: string, count: number}[]> => {
  try {
    // Get recent rides to analyze popular routes
    const recentRides = await searchRidesViaServer({
      status: 'active',
      limit: 100
    });
    
    // Count route frequency
    const routeCount: {[key: string]: number} = {};
    
    recentRides.forEach(ride => {
      const route = `${ride.departure_location} → ${ride.destination_location}`;
      routeCount[route] = (routeCount[route] || 0) + 1;
    });
    
    // Convert to array and sort by frequency
    const popularRoutes = Object.entries(routeCount)
      .map(([route, count]) => {
        const [departure, destination] = route.split(' → ');
        return { departure, destination, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 routes
    
    console.log('✅ Found', popularRoutes.length, 'popular routes');
    return popularRoutes;
    
  } catch (error) {
    console.error('❌ Error getting popular routes:', error);
    return [];
  }
};

// Advanced search with multiple filters
export const advancedSearchViaServer = async (searchParams: {
  from?: string;
  to?: string;
  date?: string;
  minSeats?: number;
  maxPrice?: number;
  userLatitude?: number;
  userLongitude?: number;
  searchRadius?: number;
}): Promise<ApiRide[]> => {
  try {
    console.log('🔍 Advanced search via server:', searchParams);
    
    const filters: RideSearchFilters = {
      status: 'active',
      limit: 50
    };
    
    // Add location filters
    if (searchParams.from) {
      filters.departure_location = searchParams.from;
    }
    
    if (searchParams.to) {
      filters.destination = searchParams.to;
    }
    
    // Add date filter
    if (searchParams.date) {
      filters.departure_date = searchParams.date;
    }
    
    // Add seat and price filters
    if (searchParams.minSeats) {
      filters.min_seats = searchParams.minSeats;
    }
    
    if (searchParams.maxPrice) {
      filters.max_price = searchParams.maxPrice;
    }
    
    // Add location-based search
    if (searchParams.userLatitude && searchParams.userLongitude) {
      filters.departure_latitude = searchParams.userLatitude;
      filters.departure_longitude = searchParams.userLongitude;
      filters.radius_km = searchParams.searchRadius || 10;
    }
    
    const rides = await searchRidesViaServer(filters);
    
    console.log('✅ Advanced search found', rides.length, 'rides');
    return rides;
    
  } catch (error) {
    console.error('❌ Error in advanced search:', error);
    throw error;
  }
};
