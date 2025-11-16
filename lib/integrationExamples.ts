// Integration examples for replacing direct Supabase calls with server API calls

import { createRideViaServer, getRidesViaServer } from './rideService';
import { searchRidesViaServer, searchLocationsViaServer, advancedSearchViaServer } from './searchService';

// ========================================
// EXAMPLE 1: Create Ride Component Integration
// ========================================

export const exampleCreateRideIntegration = {
  // OLD WAY (Direct Supabase) - REPLACE THIS
  oldCreateRide: async (formData: any) => {
    // ❌ DON'T USE THIS ANYMORE
    // const { data, error } = await supabase
    //   .from('rides')
    //   .insert({
    //     title: formData.title,
    //     departure_location: formData.from,
    //     destination_location: formData.to,
    //     departure_date: formData.date,
    //     departure_time: formData.time,
    //     total_seats: formData.seats,
    //     available_seats: formData.seats,
    //     price_per_seat: formData.price,
    //     description: formData.description,
    //     driver_id: user.id
    //   });
  },

  // NEW WAY (Through Server) - USE THIS
  newCreateRide: async (formData: {
    title: string;
    from: string;
    to: string;
    date: string;
    time: string;
    seats: number;
    price: number;
    description?: string;
    carMake?: string;
    carModel?: string;
    carColor?: string;
    licensePlate?: string;
  }) => {
    try {
      // ✅ USE THIS - Goes through server with timezone logic
      const newRide = await createRideViaServer({
        title: formData.title,
        departure_location: formData.from,
        destination_location: formData.to,
        departure_date: formData.date,
        departure_time: formData.time,
        total_seats: formData.seats,
        price_per_seat: formData.price,
        description: formData.description,
        car_make: formData.carMake,
        car_model: formData.carModel,
        car_color: formData.carColor,
        car_license_plate: formData.licensePlate,
      });

      console.log('✅ Ride created:', newRide);
      return newRide;
    } catch (error: any) {
      console.error('❌ Create ride failed:', error.message);
      throw error;
    }
  }
};

// ========================================
// EXAMPLE 2: Search/Browse Rides Integration
// ========================================

export const exampleSearchRidesIntegration = {
  // OLD WAY (Direct Supabase) - REPLACE THIS
  oldSearchRides: async (filters: any) => {
    // ❌ DON'T USE THIS ANYMORE
    // let query = supabase
    //   .from('rides')
    //   .select(`
    //     *,
    //     profiles!rides_driver_id_fkey(first_name, last_name, profile_picture_url)
    //   `)
    //   .eq('status', 'active');
    
    // if (filters.from) {
    //   query = query.ilike('departure_location', `%${filters.from}%`);
    // }
    // if (filters.to) {
    //   query = query.ilike('destination_location', `%${filters.to}%`);
    // }
    
    // const { data, error } = await query;
  },

  // NEW WAY (Through Server) - USE THIS
  newSearchRides: async (filters: {
    from?: string;
    to?: string;
    date?: string;
    minSeats?: number;
    maxPrice?: number;
    userLatitude?: number;
    userLongitude?: number;
  }) => {
    try {
      // ✅ USE THIS - Advanced search through server
      const rides = await advancedSearchViaServer({
        from: filters.from,
        to: filters.to,
        date: filters.date,
        minSeats: filters.minSeats,
        maxPrice: filters.maxPrice,
        userLatitude: filters.userLatitude,
        userLongitude: filters.userLongitude,
        searchRadius: 10 // 10km radius
      });

      console.log('✅ Found rides:', rides.length);
      return rides;
    } catch (error: any) {
      console.error('❌ Search rides failed:', error.message);
      return [];
    }
  },

  // Simple search for browse/home page
  newBrowseRides: async (limit: number = 20) => {
    try {
      // ✅ USE THIS - Get active rides through server
      const rides = await searchRidesViaServer({
        status: 'active',
        limit: limit
      });

      console.log('✅ Browse rides loaded:', rides.length);
      return rides;
    } catch (error: any) {
      console.error('❌ Browse rides failed:', error.message);
      return [];
    }
  }
};

// ========================================
// EXAMPLE 3: Location Autocomplete Integration
// ========================================

export const exampleLocationAutocompleteIntegration = {
  // OLD WAY (Direct Supabase) - REPLACE THIS
  oldSearchLocations: async (query: string) => {
    // ❌ DON'T USE THIS ANYMORE
    // const { data } = await supabase
    //   .from('rides')
    //   .select('departure_location')
    //   .ilike('departure_location', `%${query}%`)
    //   .limit(10);
  },

  // NEW WAY (Through Server) - USE THIS
  newSearchLocations: async (query: string) => {
    try {
      // ✅ USE THIS - Location search through server
      const locations = await searchLocationsViaServer(query);
      
      console.log('✅ Found locations:', locations.length);
      return locations;
    } catch (error: any) {
      console.error('❌ Location search failed:', error.message);
      return [];
    }
  }
};

// ========================================
// EXAMPLE 4: React Native Component Usage
// ========================================

export const exampleReactNativeUsage = `
// Example React Native component using the new server API

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { searchRidesViaServer, searchLocationsViaServer } from '../lib/searchService';
import { createRideViaServer } from '../lib/rideService';

export const RideSearchScreen = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load rides when component mounts
  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      setLoading(true);
      // ✅ Use server API instead of direct Supabase
      const ridesData = await searchRidesViaServer({
        status: 'active',
        limit: 20
      });
      setRides(ridesData);
    } catch (error) {
      console.error('Failed to load rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchRides = async (query: string) => {
    try {
      setLoading(true);
      // ✅ Use server API for search
      const searchResults = await searchRidesViaServer({
        departure_location: query,
        status: 'active',
        limit: 20
      });
      setRides(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // JSX return commented out for .ts file compatibility
  return null;
  /*
  return (
    <View>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={() => searchRides(searchQuery)}
        placeholder="Search rides..."
      />
      
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: any }) => (
          <View>
            <Text>{item.title}</Text>
            <Text>{item.departure_location} → {item.destination_location}</Text>
            <Text>{item.departure_date} at {item.departure_time}</Text>
            <Text>Price per seat info</Text>
          </View>
        )}
        refreshing={loading}
        onRefresh={loadRides}
      />
    </View>
  );
  */
};

export const CreateRideScreen = () => {
  const [formData, setFormData] = useState({
    title: '',
    from: '',
    to: '',
    date: '',
    time: '',
    seats: 1,
    price: 0
  });

  const handleCreateRide = async () => {
    try {
      // ✅ Use server API instead of direct Supabase
      const newRide = await createRideViaServer({
        title: formData.title,
        departure_location: formData.from,
        destination_location: formData.to,
        departure_date: formData.date,
        departure_time: formData.time,
        total_seats: formData.seats,
        price_per_seat: formData.price
      });

      console.log('Ride created successfully:', newRide);
      // Navigate back or show success message
    } catch (error) {
      console.error('Failed to create ride:', error.message);
      // Show error message to user
    }
  };

  return (
    <View>
      {/* Your form inputs here */}
      <TouchableOpacity onPress={handleCreateRide}>
        <Text>Create Ride</Text>
      </TouchableOpacity>
    </View>
  );
};
`;

// ========================================
// EXAMPLE 5: Migration Checklist
// ========================================

export const migrationChecklist = {
  steps: [
    '✅ 1. Server is running with timezone support',
    '✅ 2. API client is configured with correct types',
    '✅ 3. Search service is created for ride filtering',
    '✅ 4. Ride service is created for CRUD operations',
    '🔄 5. Replace direct Supabase calls in components',
    '🔄 6. Update create ride forms to use createRideViaServer()',
    '🔄 7. Update search/browse pages to use searchRidesViaServer()',
    '🔄 8. Update location autocomplete to use searchLocationsViaServer()',
    '🔄 9. Test all functionality end-to-end',
    '🔄 10. Handle error states and loading states'
  ],
  
  filesToUpdate: [
    'Create ride form component',
    'Ride search/browse component', 
    'Location autocomplete component',
    'My rides component',
    'Ride details component'
  ]
};
