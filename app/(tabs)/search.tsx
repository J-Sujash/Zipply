import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { notifyRideRequest, notifyRideRequestSent } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  FilterIcon,
  SearchIcon,
  StarIcon,
  TimeIcon,
  UserIcon
} from '../../components/ui/Icons';
import { Input } from '../../components/ui/Input';
import { NotificationIcon } from '../../components/ui/NotificationIcon';
import { RequestMessageModal } from '../../components/ui/RequestMessageModal';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';

interface Ride {
  id: string;
  title: string;
  driverName: string;
  driverRating: number;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  pricePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  description: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(50);
  const [selectedSeats, setSelectedSeats] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const filters = [
    { id: 'all', label: 'All Rides' },
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'this_week', label: 'This Week' },
  ];

  useEffect(() => {
    if (user) {
      fetchRides();
    }
  }, [user]);

  const fetchRides = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('rides')
        .select(`
          id,
          title,
          departure_location,
          destination_location,
          departure_date,
          departure_time,
          price_per_seat,
          available_seats,
          total_seats,
          description,
          driver:profiles!rides_driver_id_fkey (
            first_name,
            last_name,
            rating
          ),
          ride_requests (
            status,
            passenger_id
          )
        `)
        .eq('status', 'active')
        .gt('available_seats', 0)
        .neq('driver_id', user?.id || '');

      if (error) throw error;

      const formattedRides: Ride[] = (data || []).map((ride: any) => {
        // Check if current user has requested this ride
        const userRequest = ride.ride_requests?.find((req: any) => req.passenger_id === user?.id);
        
        return {
          id: ride.id,
          title: ride.title,
          driverName: `${ride.driver.first_name} ${ride.driver.last_name}`,
          driverRating: ride.driver.rating || 4.5,
          departureLocation: ride.departure_location,
          destinationLocation: ride.destination_location,
          departureDate: ride.departure_date,
          departureTime: ride.departure_time,
          pricePerSeat: ride.price_per_seat,
          availableSeats: ride.available_seats,
          totalSeats: ride.total_seats,
          description: ride.description,
          requestStatus: userRequest?.status || null,
        };
      });

      setRides(formattedRides);
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      Alert.alert('Error', 'Failed to load rides');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  const applyFilters = () => {
    console.log('Applying filters:', { selectedSeats, selectedTime, maxPrice, selectedRating });
    setShowAdvancedFilters(false);
  };

  const clearAllFilters = () => {
    setSelectedSeats(null);
    setSelectedTime(null);
    setMaxPrice(50);
    setSelectedRating(null);
  };


  const filteredRides = rides.filter(ride => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !ride.title.toLowerCase().includes(query) &&
        !ride.departureLocation.toLowerCase().includes(query) &&
        !ride.destinationLocation.toLowerCase().includes(query) &&
        !ride.driverName.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Price filter
    if (ride.pricePerSeat > maxPrice) {
      return false;
    }

    // Seats filter
    if (selectedSeats && ride.availableSeats < selectedSeats) {
      return false;
    }

    // Rating filter
    if (selectedRating && ride.driverRating < selectedRating) {
      return false;
    }

    // Time filter
    if (selectedTime) {
      const rideHour = parseInt(ride.departureTime.split(':')[0]);
      switch (selectedTime) {
        case 'morning':
          if (rideHour < 6 || rideHour >= 12) return false;
          break;
        case 'afternoon':
          if (rideHour < 12 || rideHour >= 18) return false;
          break;
        case 'evening':
          if (rideHour < 18 || rideHour >= 24) return false;
          break;
      }
    }

    // Date filter
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const rideDate = new Date(ride.departureDate);

    switch (selectedFilter) {
      case 'today':
        return rideDate.toDateString() === today.toDateString();
      case 'tomorrow':
        return rideDate.toDateString() === tomorrow.toDateString();
      case 'this_week':
        const weekFromNow = new Date(today);
        weekFromNow.setDate(today.getDate() + 7);
        return rideDate >= today && rideDate <= weekFromNow;
      default:
        return true;
    }
  });

  const handleRequestRide = (ride: Ride) => {
    setSelectedRide(ride);
    setShowRequestModal(true);
  };

  const handleSendRequest = async (message: string) => {
    if (!selectedRide || !user) return;

    try {
      setRequesting(true);

      console.log('🚀 Sending ride request...');

      // Insert the ride request
      const { data: requestData, error } = await supabase
        .from('ride_requests')
        .insert({
          ride_id: selectedRide.id,
          passenger_id: user.id,
          seats_requested: 1,
          message: message || `Hi, I'd like to join your ride!`,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log('✅ Request created with ID:', requestData.id);

      // Get driver and passenger info for notifications
      const { data: rideData } = await supabase
        .from('rides')
        .select(`
          driver_id,
          driver:profiles!rides_driver_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq('id', selectedRide.id)
        .single();

      const { data: passengerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      if (rideData && passengerProfile) {
        const passengerName = `${passengerProfile.first_name} ${passengerProfile.last_name}`;
        const driverName = rideData.driver && rideData.driver.length > 0 
          ? `${rideData.driver[0].first_name} ${rideData.driver[0].last_name}`
          : 'Unknown Driver';

        // Send notifications
        await notifyRideRequest(
          rideData.driver_id,
          passengerName,
          selectedRide.title,
          selectedRide.id,
          requestData.id
        );

        await notifyRideRequestSent(
          user.id,
          driverName,
          selectedRide.title,
          selectedRide.id,
          requestData.id
        );
      }

      Alert.alert('Success', 'Your ride request has been sent!');
      setShowRequestModal(false);
      setSelectedRide(null);
    } catch (error: any) {
      console.error('Error sending request:', error);
      Alert.alert('Error', error.message || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const renderRideCard = ({ item }: { item: Ride }) => (
    <TouchableOpacity onPress={() => router.push(`/ride/${item.id}`)}>
      <Card variant="outlined" style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={styles.rideTitle}>
            <Text style={styles.rideTitleText}>{item.title}</Text>
            <View style={styles.driverInfo}>
              <UserIcon size={16} color={Colors.textSecondary} />
              <Text style={styles.driverName}>{item.driverName}</Text>
              <StarIcon size={14} color={Colors.warning} />
              <Text style={styles.rating}>{item.driverRating.toFixed(1)}</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>${item.pricePerSeat}</Text>
            <Text style={styles.priceLabel}>per seat</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.locationText}>{item.departureLocation}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.locationText}>{item.destinationLocation}</Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <CalendarIcon size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={styles.detailItem}>
            <TimeIcon size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatTime(item.departureTime)}</Text>
          </View>
          <View style={styles.detailItem}>
            <UserIcon size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>
              {item.availableSeats}/{item.totalSeats - 1} seats
            </Text>
          </View>
        </View>

        {item.requestStatus ? (
          <View style={[
            styles.requestButton,
            styles.requestStatusContainer,
            item.requestStatus === 'pending' && styles.requestPending,
            item.requestStatus === 'approved' && styles.requestApproved,
            item.requestStatus === 'rejected' && styles.requestRejected,
          ]}>
            <Text style={[
              styles.requestStatusText,
              item.requestStatus === 'pending' && styles.requestPendingText,
              item.requestStatus === 'approved' && styles.requestApprovedText,
              item.requestStatus === 'rejected' && styles.requestRejectedText,
            ]}>
              {item.requestStatus === 'pending' && '⏳ Request Pending'}
              {item.requestStatus === 'approved' && '✅ Request Approved'}
              {item.requestStatus === 'rejected' && '❌ Request Rejected'}
            </Text>
          </View>
        ) : (
          <Button
            title="Request to Join"
            onPress={() => handleRequestRide(item)}
            style={styles.requestButton}
          />
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Find Rides</Text>
            <Text style={styles.subtitle}>
              Discover rides shared by fellow students
            </Text>
          </View>
          <NotificationIcon size={24} color={Colors.text} />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Input
            placeholder="Where are you going?"
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<SearchIcon size={20} color={Colors.textSecondary} />}
            containerStyle={styles.searchInput}
          />
          
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <FilterIcon size={20} color={Colors.primary} />
            {showAdvancedFilters ? (
              <ChevronUpIcon size={16} color={Colors.primary} />
            ) : (
              <ChevronDownIcon size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                selectedFilter === filter.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filter.id && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {showAdvancedFilters && (
          <View style={styles.advancedFilters}>
            <View style={styles.advancedFiltersHeader}>
              <FilterIcon size={20} color={Colors.primary} />
              <Text style={styles.advancedFiltersTitle}>Advanced Filters</Text>
            </View>
            
            <ScrollView 
              style={styles.filtersScrollContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.filterRow}>
                <View style={styles.filterLabelRow}>
                  <Text style={styles.filterLabel}>💰 Max Price</Text>
                </View>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceHeader}>
                    <Text style={styles.priceRangeText}>Max Price: ${Math.round(maxPrice)}</Text>
                  </View>
                  <View style={styles.sliderWrapper}>
                    <Text style={styles.sliderLabel}>$5</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={5}
                      maximumValue={100}
                      value={maxPrice}
                      onValueChange={setMaxPrice}
                      minimumTrackTintColor={Colors.primary}
                      maximumTrackTintColor={Colors.border}
                    />
                    <Text style={styles.sliderLabel}>$100</Text>
                  </View>
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterLabelRow}>
                  <UserIcon size={16} color={Colors.textSecondary} />
                  <Text style={styles.filterLabel}>Available Seats</Text>
                </View>
                <View style={styles.seatsContainer}>
                  {[1, 2, 3, 4].map((seats) => (
                    <TouchableOpacity
                      key={seats}
                      style={[
                        styles.seatChip,
                        selectedSeats === seats && styles.seatChipActive,
                      ]}
                      onPress={() => setSelectedSeats(selectedSeats === seats ? null : seats)}
                    >
                      <Text style={[
                        styles.seatChipText,
                        selectedSeats === seats && styles.seatChipTextActive,
                      ]}>
                        {seats}+
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterLabelRow}>
                  <StarIcon size={16} color={Colors.warning} />
                  <Text style={styles.filterLabel}>Driver Rating</Text>
                </View>
                <View style={styles.ratingContainer}>
                  {[3, 4, 4.5, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingChip,
                        selectedRating === rating && styles.ratingChipActive,
                      ]}
                      onPress={() => setSelectedRating(selectedRating === rating ? null : rating)}
                    >
                      <StarIcon size={14} color={selectedRating === rating ? Colors.white : Colors.warning} />
                      <Text style={[
                        styles.ratingChipText,
                        selectedRating === rating && styles.ratingChipTextActive,
                      ]}>
                        {rating}+
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterLabelRow}>
                  <ClockIcon size={16} color={Colors.textSecondary} />
                  <Text style={styles.filterLabel}>Departure Time</Text>
                </View>
                <View style={styles.timeContainer}>
                  {[
                    { id: 'morning', label: 'Morning', emoji: '🌅' },
                    { id: 'afternoon', label: 'Afternoon', emoji: '☀️' },
                    { id: 'evening', label: 'Evening', emoji: '🌆' }
                  ].map((time) => (
                    <TouchableOpacity
                      key={time.id}
                      style={[
                        styles.timeChip,
                        selectedTime === time.id && styles.timeChipActive,
                      ]}
                      onPress={() => setSelectedTime(selectedTime === time.id ? null : time.id)}
                    >
                      <Text style={styles.timeEmoji}>{time.emoji}</Text>
                      <Text style={[
                        styles.timeChipText,
                        selectedTime === time.id && styles.timeChipTextActive,
                      ]}>
                        {time.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finding rides...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRides}
          renderItem={renderRideCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ridesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🚗</Text>
              <Text style={styles.emptyStateTitle}>No rides found</Text>
              <Text style={styles.emptyStateText}>
                Try adjusting your search or check back later for new rides.
              </Text>
            </View>
          }
        />
      )}

      <RequestMessageModal
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSendRequest={handleSendRequest}
        driverName={selectedRide?.driverName || 'Unknown Driver'}
        rideTitle={selectedRide?.title || 'Ride'}
        pricePerSeat={selectedRide?.pricePerSeat || 0}
        loading={requesting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginTop: 16,
    height: 50,
    justifyContent: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
    height: 50,
  },
  filtersContainer: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  ridesList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  rideCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  rideTitle: {
    flex: 1,
  },
  rideTitleText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  driverName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  rating: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  priceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  routeContainer: {
    marginBottom: Spacing.md,
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
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 3,
    marginVertical: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  requestButton: {
    marginTop: Spacing.sm,
  },
  requestStatusContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  requestPending: {
    backgroundColor: Colors.warning + '20',
    borderColor: Colors.warning,
  },
  requestApproved: {
    backgroundColor: Colors.success + '20',
    borderColor: Colors.success,
  },
  requestRejected: {
    backgroundColor: Colors.error + '20',
    borderColor: Colors.error,
  },
  requestStatusText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  requestPendingText: {
    color: Colors.warning,
  },
  requestApprovedText: {
    color: Colors.success,
  },
  requestRejectedText: {
    color: Colors.error,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  // Advanced Filters Styles
  advancedFilters: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filtersScrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  advancedFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  advancedFiltersTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  filterRow: {
    marginBottom: Spacing.lg,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  priceRangeContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  priceHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceRangeText: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sliderLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  priceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  seatsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  seatChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 50,
    alignItems: 'center',
  },
  seatChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  seatChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  seatChipTextActive: {
    color: Colors.white,
  },
  timeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeEmoji: {
    fontSize: 18,
  },
  timeChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeChipTextActive: {
    color: Colors.white,
  },
  // Rating Filter Styles
  ratingContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 60,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  ratingChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ratingChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  ratingChipTextActive: {
    color: Colors.white,
  },
  // Price Slider Container
  priceSliderContainer: {
    flex: 1,
  },
  filterActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  applyButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: FontSize.md,
    color: Colors.white,
    fontWeight: '600',
  },
});
