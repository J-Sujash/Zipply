import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { rideApi } from '../../lib/apiClient';
import { getShadowStyle } from '../../lib/shadowUtils';
import { supabase } from '../../lib/supabase';

import { Card } from '../../components/ui/Card';
import {
    CalendarIcon,
    CarIcon,
    ClockIcon,
    PlusIcon,
    SearchIcon,
    TimeIcon,
    UserIcon,
    UsersIcon
} from '../../components/ui/Icons';
import { MessageIconWithBadge } from '../../components/ui/MessageIcon';
import { NotificationIcon } from '../../components/ui/NotificationIcon';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';

const { width } = Dimensions.get('window');

interface QuickStat {
  id: string;
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

interface RideMember {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  role: 'driver' | 'passenger';
}

interface RecentRide {
  id: string;
  title: string;
  type: 'driver' | 'passenger';
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  status: string;
  // Optional fields for enhanced display
  availableSeats?: number;
  totalSeats?: number;
  seatsRequested?: number;
  // Members (passengers for driver view, driver + other passengers for passenger view)
  members?: RideMember[];
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  date: string;
}

interface OngoingRide {
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

export default function HomeScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Student');
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Ongoing ride tracking state (10 min before to 30 min after)
  const [ongoingRides, setOngoingRides] = useState<OngoingRide[]>([]);
  const [selectedOngoingRide, setSelectedOngoingRide] = useState<OngoingRide | null>(null);
  const [showOngoingModal, setShowOngoingModal] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('🏠 HOME SCREEN: User logged in, fetching data for:', user.id);
      fetchHomeData();
      
      // Set up periodic ongoing ride checking (every 30 seconds)
      const ongoingRideInterval = setInterval(() => {
        fetchOngoingRides();
      }, 30000); // Check every 30 seconds
      
      return () => {
        clearInterval(ongoingRideInterval);
      };
    }
  }, [user]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUserProfile(),
        fetchQuickStats(),
        fetchRecentRides(),
        fetchAnnouncements(),
        fetchOngoingRides(),
      ]);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setUserName(data ? `${data.first_name} ${data.last_name}` : 'Student');
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserName('Student');
    }
  };

  const fetchQuickStats = async () => {
    try {
      if (!user?.id) {
        return;
      }
      
      // Helper function to check if a ride is in the future (using local timezone)
      const isRideFuture = (departureDate: string, departureTime: string): boolean => {
        try {
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          return rideDateTime > new Date();
        } catch (error) {
          console.log(`❌ Error parsing date: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // Helper function to check if a ride is in the past (completed)
      const isRidePast = (departureDate: string, departureTime: string): boolean => {
        try {
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          return rideDateTime < new Date();
        } catch (error) {
          console.log(`❌ Error parsing date: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // 1. Fetch ACTIVE rides offered by user (only future rides)
      const { data: allOfferedRides, error: offeredError } = await supabase
        .from('rides')
        .select('id, status, departure_date, departure_time')
        .eq('driver_id', user?.id)
        .eq('status', 'active');

      if (offeredError) {
        console.error('❌ Error fetching offered rides:', offeredError);
        throw offeredError;
      }

      const activeOfferedRides = (allOfferedRides || []).filter(ride => 
        isRideFuture(ride.departure_date, ride.departure_time)
      );

      // 2. Fetch PENDING and APPROVED ride requests by user (only for future rides)
      const { data: allRequestedRides, error: requestedError } = await supabase
        .from('ride_requests')
        .select(`
          id, 
          status,
          ride:rides!inner (
            departure_date,
            departure_time,
            status
          )
        `)
        .eq('passenger_id', user?.id)
        .in('status', ['pending', 'approved']);

      if (requestedError) {
        console.error('❌ Error fetching requested rides:', requestedError);
        throw requestedError;
      }

      const activeRequestedRides = (allRequestedRides || []).filter((request: any) => 
        request.ride && 
        request.ride.status === 'active' &&
        isRideFuture(request.ride.departure_date, request.ride.departure_time)
      );

      // 3. Fetch available rides (active rides with seats, excluding user's own rides)
      const { data: allAvailableRides, error: availableError } = await supabase
        .from('rides')
        .select('id, departure_date, departure_time')
        .eq('status', 'active')
        .gt('available_seats', 0)
        .neq('driver_id', user?.id || '');

      if (availableError) {
        console.error('❌ Error fetching available rides:', availableError);
        throw availableError;
      }

      const futureAvailableRides = (allAvailableRides || []).filter(ride => 
        isRideFuture(ride.departure_date, ride.departure_time)
      );

      // 4. Fetch ride history - completed rides (past rides only)
      const { data: allDriverRides, error: driverHistoryError } = await supabase
        .from('rides')
        .select('id, departure_date, departure_time, status')
        .eq('driver_id', user?.id);

      if (driverHistoryError) {
        console.error('❌ Error fetching driver ride history:', driverHistoryError);
        throw driverHistoryError;
      }

      // Count past rides (completed or cancelled after departure time)
      const completedDriverRides = (allDriverRides || []).filter(ride => 
        isRidePast(ride.departure_date, ride.departure_time)
      );

      const { data: allPassengerRequests, error: passengerHistoryError } = await supabase
        .from('ride_requests')
        .select(`
          id,
          status,
          ride:rides!inner (
            departure_date,
            departure_time
          )
        `)
        .eq('passenger_id', user?.id)
        .eq('status', 'approved');

      if (passengerHistoryError) {
        console.error('❌ Error fetching passenger ride history:', passengerHistoryError);
        throw passengerHistoryError;
      }

      // Count past approved rides
      const completedPassengerRides = (allPassengerRequests || []).filter((request: any) => 
        request.ride && isRidePast(request.ride.departure_date, request.ride.departure_time)
      );


      const stats: QuickStat[] = [
        {
          id: '1',
          title: 'Active Rides Offered',
          value: activeOfferedRides.length.toString(),
          icon: <CarIcon size={24} color={Colors.primary} />,
          color: Colors.primary,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '2',
          title: 'Active Requests',
          value: activeRequestedRides.length.toString(),
          icon: <UserIcon size={24} color={Colors.success} />,
          color: Colors.success,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '3',
          title: 'Available Rides',
          value: futureAvailableRides.length.toString(),
          icon: <SearchIcon size={24} color={Colors.warning} />,
          color: Colors.warning,
          onPress: () => router.push('/(tabs)/search'),
        },
        {
          id: '4',
          title: 'Ride History',
          value: (completedDriverRides.length + completedPassengerRides.length).toString(),
          icon: <UsersIcon size={24} color={Colors.error} />,
          color: Colors.error,
          onPress: () => router.push('/ride-history'),
        },
      ];

      setQuickStats(stats);
    } catch (error) {
      console.error('Error fetching quick stats:', error);
      // Set default stats in case of error
      const defaultStats: QuickStat[] = [
        {
          id: '1',
          title: 'Active Rides Offered',
          value: '0',
          icon: <CarIcon size={24} color={Colors.primary} />,
          color: Colors.primary,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '2',
          title: 'Active Requests',
          value: '0',
          icon: <UserIcon size={24} color={Colors.success} />,
          color: Colors.success,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '3',
          title: 'Available Rides',
          value: '0',
          icon: <SearchIcon size={24} color={Colors.warning} />,
          color: Colors.warning,
          onPress: () => router.push('/(tabs)/search'),
        },
        {
          id: '4',
          title: 'Ride History',
          value: '0',
          icon: <UsersIcon size={24} color={Colors.error} />,
          color: Colors.error,
          onPress: () => router.push('/ride-history'),
        },
      ];
      setQuickStats(defaultStats);
    }
  };

  const fetchOngoingRides = async () => {
    try {
      if (!user?.id) return;
      
      // Call the new ongoing rides API endpoint
      const response = await rideApi.getOngoingRides();
      
      setOngoingRides(response || []);
      
    } catch (error) {
      console.error('❌ Error fetching ongoing rides:', error);
      setOngoingRides([]);
    }
  };

  const fetchRecentRides = async () => {
    try {
      if (!user?.id) {
        return;
      }
      
      // Reuse the same helper functions from fetchQuickStats for consistency
      const isRideFuture = (departureDate: string, departureTime: string): boolean => {
        try {
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          return rideDateTime > new Date();
        } catch (error) {
          console.log(`❌ Error parsing date: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // Get current date/time for database filtering
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

      // 1. Fetch ACTIVE upcoming rides as driver (more efficient database filtering)
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('id, title, departure_location, destination_location, departure_date, departure_time, status, available_seats, total_seats')
        .eq('driver_id', user?.id)
        .eq('status', 'active')
        .gte('departure_date', currentDate) // Only today or future dates
        .order('departure_date', { ascending: true })
        .order('departure_time', { ascending: true })
        .limit(20); // Get more to filter by time

      if (driverError) {
        console.error('❌ Error fetching driver rides:', driverError);
        throw driverError;
      }

      // 2. Fetch APPROVED ride requests for ACTIVE upcoming rides (as passenger)
      const { data: passengerRequests, error: passengerError } = await supabase
        .from('ride_requests')
        .select(`
          id,
          status,
          seats_requested,
          ride:rides!inner (
            id,
            title,
            departure_location,
            destination_location,
            departure_date,
            departure_time,
            status,
            driver_id
          )
        `)
        .eq('passenger_id', user?.id)
        .eq('status', 'approved')
        .eq('ride.status', 'active')
        .gte('ride.departure_date', currentDate) // Only today or future dates
        .limit(20); // Get more to filter by time

      if (passengerError) {
        console.error('❌ Error fetching passenger requests:', passengerError);
        throw passengerError;
      }

      // Filter driver rides (only future rides)
      const futureDriverRides = (driverRides || [])
        .filter((ride: any) => isRideFuture(ride.departure_date, ride.departure_time));

      // Fetch passengers for driver rides
      const driverRideIds = futureDriverRides.map((ride: any) => ride.id);
      const driverRideMembers: Record<string, RideMember[]> = {};
      
      if (driverRideIds.length > 0) {
        const { data: passengersData, error: passengersError } = await supabase
          .from('ride_requests')
          .select(`
            ride_id,
            passenger:profiles!ride_requests_passenger_id_fkey (
              id,
              first_name,
              last_name,
              profile_picture_url
            )
          `)
          .in('ride_id', driverRideIds)
          .eq('status', 'approved');

        if (!passengersError && passengersData) {
          passengersData.forEach((request: any) => {
            if (request.passenger) {
              if (!driverRideMembers[request.ride_id]) {
                driverRideMembers[request.ride_id] = [];
              }
              driverRideMembers[request.ride_id].push({
                id: request.passenger.id,
                first_name: request.passenger.first_name,
                last_name: request.passenger.last_name,
                profile_picture_url: request.passenger.profile_picture_url,
                role: 'passenger' as const,
              });
            }
          });
        }
      }

      // Format driver rides with members
      const formattedDriverRides: RecentRide[] = futureDriverRides.map((ride: any) => ({
        id: ride.id,
        title: ride.title,
        type: 'driver' as const,
        departureLocation: ride.departure_location,
        destinationLocation: ride.destination_location,
        departureDate: ride.departure_date,
        departureTime: ride.departure_time,
        status: 'upcoming' as const,
        availableSeats: ride.available_seats,
        totalSeats: ride.total_seats,
        members: driverRideMembers[ride.id] || [],
      }));

      // Filter passenger rides (only future rides)
      const futurePassengerRides = (passengerRequests || [])
        .filter((request: any) => 
          request.ride && 
          isRideFuture(request.ride.departure_date, request.ride.departure_time)
        );

      // Fetch driver and other passengers for passenger rides
      const passengerRideIds = futurePassengerRides.map((request: any) => request.ride.id);
      const passengerRideMembers: Record<string, RideMember[]> = {};
      
      if (passengerRideIds.length > 0) {
        // Fetch driver profiles
        const uniqueRideIds = [...new Set(passengerRideIds)];
        const { data: ridesData, error: ridesError } = await supabase
          .from('rides')
          .select(`
            id,
            driver_id,
            driver:profiles!rides_driver_id_fkey (
              id,
              first_name,
              last_name,
              profile_picture_url
            )
          `)
          .in('id', uniqueRideIds);

        if (!ridesError && ridesData) {
          ridesData.forEach((ride: any) => {
            if (ride.driver) {
              if (!passengerRideMembers[ride.id]) {
                passengerRideMembers[ride.id] = [];
              }
              passengerRideMembers[ride.id].push({
                id: ride.driver.id,
                first_name: ride.driver.first_name,
                last_name: ride.driver.last_name,
                profile_picture_url: ride.driver.profile_picture_url,
                role: 'driver' as const,
              });
            }
          });
        }

        // Fetch other passengers (excluding current user)
        const { data: otherPassengersData, error: otherPassengersError } = await supabase
          .from('ride_requests')
          .select(`
            ride_id,
            passenger:profiles!ride_requests_passenger_id_fkey (
              id,
              first_name,
              last_name,
              profile_picture_url
            )
          `)
          .in('ride_id', uniqueRideIds)
          .eq('status', 'approved')
          .neq('passenger_id', user?.id);

        if (!otherPassengersError && otherPassengersData) {
          otherPassengersData.forEach((request: any) => {
            if (request.passenger) {
              if (!passengerRideMembers[request.ride_id]) {
                passengerRideMembers[request.ride_id] = [];
              }
              passengerRideMembers[request.ride_id].push({
                id: request.passenger.id,
                first_name: request.passenger.first_name,
                last_name: request.passenger.last_name,
                profile_picture_url: request.passenger.profile_picture_url,
                role: 'passenger' as const,
              });
            }
          });
        }
      }

      // Format passenger rides with members
      const formattedPassengerRides: RecentRide[] = futurePassengerRides.map((request: any) => ({
        id: request.ride.id,
        title: request.ride.title,
        type: 'passenger' as const,
        departureLocation: request.ride.departure_location,
        destinationLocation: request.ride.destination_location,
        departureDate: request.ride.departure_date,
        departureTime: request.ride.departure_time,
        status: 'upcoming' as const,
        seatsRequested: request.seats_requested,
        members: passengerRideMembers[request.ride.id] || [],
      }));

      // Combine and sort by departure time (earliest first)
      const allUpcomingRides = [...formattedDriverRides, ...formattedPassengerRides]
        .sort((a, b) => {
          // Create proper datetime objects for accurate sorting
          const [yearA, monthA, dayA] = a.departureDate.split('-').map(Number);
          const [hoursA, minutesA, secondsA = 0] = a.departureTime.split(':').map(Number);
          const dateTimeA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA, secondsA);
          
          const [yearB, monthB, dayB] = b.departureDate.split('-').map(Number);
          const [hoursB, minutesB, secondsB = 0] = b.departureTime.split(':').map(Number);
          const dateTimeB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB, secondsB);
          
          return dateTimeA.getTime() - dateTimeB.getTime();
        })
        .slice(0, 5); // Show top 5 upcoming rides

      setRecentRides(allUpcomingRides);
    } catch (error) {
      console.error('❌ Error fetching upcoming rides:', error);
      setRecentRides([]); // Set empty array on error
    }
  };

  const fetchAnnouncements = async () => {
    // Mock announcements for now - in a real app, these would come from a database
    const mockAnnouncements: Announcement[] = [
      {
        id: '1',
        title: '🎉 Welcome to Zipply!',
        message: 'Connect with fellow students and share rides safely and affordably.',
        type: 'success',
        date: new Date().toISOString(),
      },
      {
        id: '2',
        title: '🚗 Safety First',
        message: 'Always verify driver details and share your trip with friends.',
        type: 'info',
        date: new Date().toISOString(),
      },
      {
        id: '3',
        title: '💰 Save Money',
        message: 'Split gas costs and reduce your carbon footprint by carpooling.',
        type: 'warning',
        date: new Date().toISOString(),
      },
    ];

    setAnnouncements(mockAnnouncements);
  };


  const onRefresh = () => {
    setRefreshing(true);
    fetchHomeData();
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    // Split "2025-11-11" and create local date instead of UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
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

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getOngoingRideStatus = (ride: OngoingRide) => {
    try {
      const now = new Date();
      const [year, month, day] = ride.departureDate.split('-').map(Number);
      const [hours, minutes, seconds = 0] = ride.departureTime.split(':').map(Number);
      const rideStart = new Date(year, month - 1, day, hours, minutes, seconds);
      
      const diffMs = rideStart.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      
      if (diffMinutes > 0) {
        // Before departure
        if (diffMinutes <= 10) {
          return {
            status: 'starting_soon',
            text: `Starting in ${diffMinutes} min`,
            color: Colors.warning,
            icon: '⏰'
          };
        }
      } else {
        // After departure
        const minutesPast = Math.abs(diffMinutes);
        if (minutesPast <= 30) {
          return {
            status: 'in_progress',
            text: `${minutesPast} min ago`,
            color: Colors.success,
            icon: '🚗'
          };
        }
      }
      
      return {
        status: 'active',
        text: 'Active',
        color: Colors.primary,
        icon: '🟢'
      };
    } catch (error) {
      return {
        status: 'active',
        text: 'Active',
        color: Colors.primary,
        icon: '🟢'
      };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return Colors.primary;
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '🚗';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '📅';
    }
  };

  const getAnnouncementColor = (type: string) => {
    switch (type) {
      case 'success':
        return Colors.success;
      case 'warning':
        return Colors.warning;
      case 'info':
        return Colors.primary;
    }
  };

  const renderQuickStat = ({ item }: { item: QuickStat }) => (
    <TouchableOpacity 
      onPress={item.onPress} 
      style={styles.statCard}
      activeOpacity={0.7}
    >
      <View style={[styles.statCardInner, { backgroundColor: item.color + '08' }]}>
        <View style={[styles.statIconContainer, { backgroundColor: item.color + '15' }]}>
          {item.icon}
        </View>
        <View style={styles.statContent}>
          <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.statTitle} numberOfLines={2} ellipsizeMode="tail">{item.title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRecentRide = ({ item }: { item: RecentRide }) => (
    <TouchableOpacity onPress={() => router.push(`/ride/${item.id}`)} style={styles.rideCard}>
      <Card variant="outlined" style={styles.rideCardInner}>
        <View style={styles.rideHeader}>
          <View style={styles.rideTypeContainer}>
            <View style={[styles.rideTypeBadge, { backgroundColor: item.type === 'driver' ? Colors.primary + '20' : Colors.success + '20' }]}>
              <Text style={[styles.rideTypeText, { color: item.type === 'driver' ? Colors.primary : Colors.success }]}>
                {item.type === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusEmoji(item.status)} {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.rideTitle}>{item.title}</Text>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.departureLocation}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.destinationLocation}</Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <CalendarIcon size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={styles.detailItem}>
            <TimeIcon size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatTime(item.departureTime)}</Text>
          </View>
          {/* Show seat information */}
          {item.type === 'driver' && item.availableSeats !== undefined && item.totalSeats !== undefined && (
            <View style={styles.detailItem}>
              <UsersIcon size={14} color={Colors.textSecondary} />
              <Text style={styles.detailText}>{item.availableSeats}/{item.totalSeats} seats</Text>
            </View>
          )}
          {item.type === 'passenger' && item.seatsRequested !== undefined && (
            <View style={styles.detailItem}>
              <UserIcon size={14} color={Colors.textSecondary} />
              <Text style={styles.detailText}>{item.seatsRequested} seat{item.seatsRequested > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Members section - show passengers for drivers, driver + other passengers for passengers */}
        {item.members && item.members.length > 0 && (
          <>
            <View style={styles.dividerLine} />
            <View style={styles.passengersSection}>
              <Text style={styles.passengersSectionTitle}>
                {item.type === 'driver' ? 'Passengers' : 'Ride Members'} ({item.members.length})
              </Text>
              <View style={styles.passengersList}>
                {item.members.map((member) => (
                  <View key={member.id} style={styles.passengerItem}>
                    <View style={styles.passengerAvatar}>
                      {member.profile_picture_url ? (
                        <Image 
                          source={{ uri: member.profile_picture_url }} 
                          style={styles.passengerImage}
                        />
                      ) : (
                        <View style={styles.passengerPlaceholder}>
                          <Text style={styles.passengerInitial}>
                            {member.first_name?.[0]?.toUpperCase() || 'U'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.acceptedPassengerName}>
                      {member.first_name} {member.last_name}
                    </Text>
                    {member.role === 'driver' && (
                      <View style={styles.driverBadgeSmall}>
                        <CarIcon size={10} color={Colors.white} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </Card>
    </TouchableOpacity>
  );

  const renderAnnouncement = ({ item }: { item: Announcement }) => (
    <Card variant="outlined" style={StyleSheet.flatten([styles.announcementCard, { borderLeftColor: getAnnouncementColor(item.type) }])}>
      <Text style={styles.announcementTitle}>{item.title}</Text>
      <Text style={styles.announcementMessage}>{item.message}</Text>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName}! 👋</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity 
                onPress={() => router.push('/chats')}
                style={styles.headerIconButton}
              >
                <MessageIconWithBadge size={24} color={Colors.text} />
              </TouchableOpacity>
              <NotificationIcon 
                size={24} 
                color={Colors.text}
              />
            </View>
          </View>
        </View>


        {/* Ongoing Rides Section */}
        {ongoingRides.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ongoing Rides</Text>
            {ongoingRides.map((ride, index) => {
              const statusInfo = getOngoingRideStatus(ride);
              return (
                <OngoingRideCard
                  key={ride.id}
                  ride={ride}
                  statusInfo={statusInfo}
                  index={index}
                  onPress={() => {
                    setSelectedOngoingRide(ride);
                    setShowOngoingModal(true);
                  }}
                />
              );
            })}
          </View>
        )}

        {/* Ongoing Ride Details Modal */}
        <Modal
          visible={showOngoingModal}
          transparent
          animationType="none"
          onRequestClose={() => setShowOngoingModal(false)}
        >
          <OngoingRideModal
            ride={selectedOngoingRide}
            visible={showOngoingModal}
            onClose={() => {
              setShowOngoingModal(false);
              setSelectedOngoingRide(null);
            }}
            onRate={() => {
              if (selectedOngoingRide) {
                setShowOngoingModal(false);
                router.push(`/rate-ride/${selectedOngoingRide.id}` as any);
              }
            }}
          />
        </Modal>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.modernActionButton}
              onPress={() => router.push('/(tabs)/search')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionButtonGradient, { backgroundColor: Colors.primary }]}>
                <View style={styles.actionButtonIconContainer}>
                  <SearchIcon size={20} color={Colors.white} />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.modernActionButtonTitle}>Find Rides</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modernActionButton}
              onPress={() => router.push('/(tabs)/create')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionButtonGradient, { backgroundColor: Colors.success }]}>
                <View style={styles.actionButtonIconContainer}>
                  <PlusIcon size={20} color={Colors.white} />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.modernActionButtonTitle}>Offer Ride</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          <FlatList
            data={quickStats}
            renderItem={renderQuickStat}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
            style={{ backgroundColor: Colors.background }}
            ItemSeparatorComponent={() => <View style={{ width: Spacing.md, backgroundColor: Colors.background }} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyStatsContainer}>
                <Text style={styles.emptyStatsText}>Loading your activity...</Text>
              </View>
            )}
          />
        </View>

        {/* Upcoming Rides */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Rides</Text>
          {recentRides.length > 0 ? (
            <FlatList
              data={recentRides}
              renderItem={renderRecentRide}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ridesContainer}
            />
          ) : (
            <Card variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptyText}>Start by searching for rides or offering one!</Text>
            </Card>
          )}
        </View>

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campus Updates</Text>
          <FlatList
            data={announcements}
            renderItem={renderAnnouncement}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

      </ScrollView>

    </SafeAreaView>
  );
}

// Ongoing Ride Card Component with Animation
interface OngoingRideCardProps {
  ride: OngoingRide;
  statusInfo: {
    status: string;
    text: string;
    color: string;
    icon: string;
  };
  index: number;
  onPress: () => void;
}

function OngoingRideCard({ ride, statusInfo, index, onPress }: OngoingRideCardProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Card variant="outlined" style={styles.ongoingRideCard}>
          <View style={styles.ongoingRideHeader}>
            <View style={styles.ongoingRideStatus}>
              <Animated.View
                style={[
                  styles.ongoingRidePulse,
                  { backgroundColor: statusInfo.color },
                  {
                    transform: [{
                      scale: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    }],
                  },
                ]}
              />
              <Text style={[styles.ongoingRideStatusText, { color: statusInfo.color }]}>
                {ride.userRole === 'driver' ? '🚗 Driving' : '🎒 Riding'}
              </Text>
            </View>
            <View style={styles.ongoingRideTimeContainer}>
              <ClockIcon size={14} color={Colors.textSecondary} />
              <Text style={styles.ongoingRideTime}>
                {formatTime(ride.departureTime)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.ongoingRideTitle}>{ride.title}</Text>
          
          <View style={styles.ongoingRideRoute}>
            <View style={styles.ongoingRoutePoint}>
              <View style={[styles.ongoingRouteDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.departureLocation}</Text>
            </View>
            <View style={styles.ongoingRouteLine} />
            <View style={styles.ongoingRoutePoint}>
              <View style={[styles.ongoingRouteDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.destinationLocation}</Text>
            </View>
          </View>

          {/* Vehicle Info */}
          {ride.vehicle && (
            <View style={styles.ongoingCardVehicleSection}>
              <View style={styles.ongoingCardVehicleRow}>
                <View style={styles.ongoingCardVehicleLeft}>
                  <View style={[styles.ongoingCardVehicleIcon, { backgroundColor: Colors.primary + '15' }]}>
                    <CarIcon size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.ongoingCardVehicleInfo}>
                    <Text style={styles.ongoingCardVehicleText} numberOfLines={1}>
                      {ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model}
                    </Text>
                  </View>
                </View>
                <View style={styles.ongoingCardLicenseBadge}>
                  <Text style={styles.ongoingCardLicenseText}>{ride.vehicle.licensePlate}</Text>
                </View>
              </View>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Ongoing Ride Modal Component
interface OngoingRideModalProps {
  ride: OngoingRide | null;
  visible: boolean;
  onClose: () => void;
  onRate: () => void;
}

function OngoingRideModal({ ride, visible, onClose, onRate }: OngoingRideModalProps) {
  const slideAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getOngoingRideStatus = (ride: OngoingRide) => {
    try {
      const now = new Date();
      const [year, month, day] = ride.departureDate.split('-').map(Number);
      const [hours, minutes, seconds = 0] = ride.departureTime.split(':').map(Number);
      const rideStart = new Date(year, month - 1, day, hours, minutes, seconds);
      
      const diffMs = rideStart.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      
      if (diffMinutes > 0) {
        if (diffMinutes <= 10) {
          return {
            status: 'starting_soon',
            text: `Starting in ${diffMinutes} min`,
            color: Colors.warning,
            icon: '⏰'
          };
        }
      } else {
        const minutesPast = Math.abs(diffMinutes);
        if (minutesPast <= 30) {
          return {
            status: 'in_progress',
            text: `${minutesPast} min ago`,
            color: Colors.success,
            icon: '🚗'
          };
        }
      }
      
      return {
        status: 'active',
        text: 'Active',
        color: Colors.primary,
        icon: '🟢'
      };
    } catch (error) {
      return {
        status: 'active',
        text: 'Active',
        color: Colors.primary,
        icon: '🟢'
      };
    }
  };

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!ride) return null;

  const statusInfo = getOngoingRideStatus(ride);
  const screenHeight = Dimensions.get('window').height;
  const modalHeight = screenHeight * 0.75;

  return (
    <View style={styles.modalContainer}>
      <Animated.View
        style={[
          styles.modalBackdrop,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.modalContent,
          {
            height: modalHeight,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle Bar */}
        <View style={styles.modalHandle}>
          <View style={styles.modalHandleBar} />
        </View>

        <ScrollView
          style={styles.modalScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalScrollContent}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalStatusBadge, { backgroundColor: statusInfo.color + '15' }]}>
                <View style={[styles.modalStatusPulse, { backgroundColor: statusInfo.color }]} />
                <Text style={[styles.modalStatusText, { color: statusInfo.color }]}>
                  {ride.userRole === 'driver' ? '🚗 Driving' : '🎒 Riding'}
                </Text>
              </View>
              <Text style={styles.modalStatusTime}>{statusInfo.text}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>{ride.title}</Text>

          {/* Route Section */}
          <View style={styles.modalSection}>
            <Card variant="outlined" style={styles.modalSectionCard}>
              <View style={styles.modalRouteContainer}>
                <View style={styles.modalRoutePoint}>
                  <View style={[styles.modalRouteDot, { backgroundColor: Colors.success }]} />
                  <View style={styles.modalRouteContent}>
                    <Text style={styles.modalRouteLabel}>From</Text>
                    <Text style={styles.modalRouteText}>{ride.departureLocation}</Text>
                  </View>
                </View>
                <View style={styles.modalRouteLine} />
                <View style={styles.modalRoutePoint}>
                  <View style={[styles.modalRouteDot, { backgroundColor: Colors.error }]} />
                  <View style={styles.modalRouteContent}>
                    <Text style={styles.modalRouteLabel}>To</Text>
                    <Text style={styles.modalRouteText}>{ride.destinationLocation}</Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>

          {/* Date & Time Section */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Schedule</Text>
            <View style={styles.modalInfoRow}>
              <Card variant="outlined" style={styles.modalInfoCard}>
                <View style={styles.modalInfoItem}>
                  <CalendarIcon size={18} color={Colors.primary} />
                  <View style={styles.modalInfoContent}>
                    <Text style={styles.modalInfoLabel}>Date</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(ride.departureDate)}</Text>
                  </View>
                </View>
              </Card>
              <Card variant="outlined" style={styles.modalInfoCard}>
                <View style={styles.modalInfoItem}>
                  <ClockIcon size={18} color={Colors.primary} />
                  <View style={styles.modalInfoContent}>
                    <Text style={styles.modalInfoLabel}>Time</Text>
                    <Text style={styles.modalInfoValue}>{formatTime(ride.departureTime)}</Text>
                  </View>
                </View>
              </Card>
            </View>
          </View>

          {/* Vehicle Section */}
          {ride.vehicle && (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Vehicle</Text>
              <Card variant="outlined" style={styles.modalSectionCard}>
                <View style={styles.modalVehicleCard}>
                  <View style={styles.modalVehicleLeft}>
                    <View style={[styles.modalVehicleIcon, { backgroundColor: Colors.primary + '15' }]}>
                      <CarIcon size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.modalVehicleInfo}>
                      <Text style={styles.modalVehicleName}>
                        {ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model}
                      </Text>
                      <View style={styles.modalLicensePlateBadge}>
                        <Text style={styles.modalLicensePlateLabel}>License Plate</Text>
                        <Text style={styles.modalLicensePlate}>{ride.vehicle.licensePlate}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            </View>
          )}

          {/* Participants Section */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>
              {ride.userRole === 'driver' ? 'Passengers' : 'Driver'}
            </Text>
            {ride.userRole === 'passenger' && ride.driverName && (
              <Card variant="outlined" style={styles.modalSectionCard}>
                <View style={styles.modalParticipantCard}>
                  <View style={[styles.modalParticipantAvatar, { backgroundColor: Colors.primary }]}>
                    <UserIcon size={20} color={Colors.white} />
                  </View>
                  <View style={styles.modalParticipantInfo}>
                    <Text style={styles.modalParticipantRole}>Driver</Text>
                    <Text style={styles.modalParticipantName}>{ride.driverName}</Text>
                  </View>
                </View>
              </Card>
            )}
            {ride.userRole === 'driver' && ride.passengerCount !== undefined && (
              <Card variant="outlined" style={styles.modalSectionCard}>
                <View style={styles.modalParticipantCard}>
                  <View style={[styles.modalParticipantAvatar, { backgroundColor: Colors.success }]}>
                    <UsersIcon size={20} color={Colors.white} />
                  </View>
                  <View style={styles.modalParticipantInfo}>
                    <Text style={styles.modalParticipantRole}>Passengers</Text>
                    <Text style={styles.modalParticipantName}>
                      {ride.passengerCount} of {ride.totalSeats} seats filled
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => {
                onClose();
                router.push(`/ride/${ride.id}`);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonSecondaryText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={onRate}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonPrimaryText}>⭐ Rate Ride</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  modernActionButton: {
    flex: 1,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.1,
      8,
      4
    ),
  },
  actionButtonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  actionButtonContent: {
    flex: 1,
  },
  modernActionButtonTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
  },
  emptyStatsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyStatsText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  statCard: {
    width: width * 0.65,
    height: 120,
  },
  statCardInner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 120,
    backgroundColor: Colors.white,
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      12,
      3
    ),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  statContent: {
    flex: 1,
    justifyContent: 'center',
    height: '100%',
  },
  statValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    textAlign: 'left',
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  statTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'left',
    lineHeight: 18,
    fontWeight: '500',
  },
  ridesContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  rideCard: {
    width: width * 0.75,
  },
  rideCardInner: {
    padding: Spacing.md,
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      8,
      3
    ),
  },
  rideHeader: {
    marginBottom: Spacing.sm,
  },
  rideTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rideTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  rideTypeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  rideTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  routeContainer: {
    marginBottom: Spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 3,
    marginVertical: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  announcementCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      8,
      3
    ),
  },
  announcementTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  announcementMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emptyCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      8,
      3
    ),
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Live Ride Banner Styles
  liveRideBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: '#FEF3F2',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    ...getShadowStyle(
      '#EF4444',
      { width: 0, height: 2 },
      0.1,
      4,
      3
    ),
  },
  liveRideIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  liveRidePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: Spacing.xs,
  },
  liveRideText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#DC2626',
  },
  liveRideTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  liveRideSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Section Header with Badge
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ongoingBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongoingBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  // Ongoing Rides Styles - Concise Outline Style
  ongoingRideCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  ongoingRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  ongoingRideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ongoingRidePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  ongoingRideStatusText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  ongoingRideTime: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  ongoingRideTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ongoingRideTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  ongoingRideRoute: {
    marginBottom: 0,
  },
  ongoingRoutePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  ongoingRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  ongoingRouteLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 4,
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  routeText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  // Ongoing Card Vehicle Section
  ongoingCardVehicleSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '40',
  },
  ongoingCardVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ongoingCardVehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  ongoingCardVehicleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  ongoingCardVehicleInfo: {
    flex: 1,
  },
  ongoingCardVehicleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  ongoingCardLicenseBadge: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ongoingCardLicenseText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  ongoingTimeInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '40',
  },
  ongoingTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ongoingTimeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  vehicleText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  licensePlate: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // New ongoing rides styles
  ongoingVehicleSection: {
    marginBottom: Spacing.md,
  },
  ongoingVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary + '08',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  ongoingVehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ongoingVehicleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongoingVehicleDetails: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  ongoingVehicleName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  ongoingLicensePlateContainer: {
    alignItems: 'flex-end',
  },
  ongoingLicensePlateLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  ongoingLicensePlateBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  ongoingLicensePlate: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  ongoingParticipantsSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ongoingTapIndicator: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '30',
    alignItems: 'flex-end',
  },
  ongoingTapText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  ongoingParticipantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    minHeight: 50,
  },
  ongoingParticipantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  ongoingParticipantDetails: {
    flex: 1,
  },
  ongoingParticipantRole: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  ongoingParticipantName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  driverName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  passengerCount: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  // Passengers section styles (matching requests page)
  dividerLine: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  passengersSection: {
    marginBottom: 0,
  },
  passengersSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  passengersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  passengerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.xs,
    overflow: 'hidden',
  },
  passengerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  passengerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  passengerInitial: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  acceptedPassengerName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  driverBadgeSmall: {
    marginLeft: Spacing.xs,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...getShadowStyle('#000', { width: 0, height: -4 }, 0.1, 20, 8),
  },
  modalHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 6,
  },
  modalStatusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  modalStatusText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  modalStatusTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  modalSectionCard: {
    marginBottom: 0,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalRouteContainer: {
    padding: Spacing.md,
  },
  modalRoutePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  modalRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
    marginTop: 2,
  },
  modalRouteContent: {
    flex: 1,
  },
  modalRouteLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  modalRouteText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  modalRouteLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 6,
    marginBottom: Spacing.sm,
  },
  modalInfoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalInfoCard: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalInfoContent: {
    flex: 1,
  },
  modalInfoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  modalInfoValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  modalVehicleCard: {
    padding: Spacing.md,
  },
  modalVehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalVehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalVehicleInfo: {
    flex: 1,
  },
  modalVehicleName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalLicensePlateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalLicensePlateLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalLicensePlate: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  modalParticipantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  modalParticipantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalParticipantInfo: {
    flex: 1,
  },
  modalParticipantRole: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  modalParticipantName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonPrimaryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  modalButtonSecondaryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
});
