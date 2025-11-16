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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { rideApi } from '../../lib/apiClient';
import { notifyRideRequestSent } from '../../lib/notifications';
import { getShadowStyle } from '../../lib/shadowUtils';

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
import { sendNotification } from '../../lib/notificationManager';

// PERFORMANCE OPTIMIZATION - Caching and faster loading
const CACHE_BUSTER = '2025-10-27-00:48:00-PERFORMANCE-OPTIMIZATION';

interface Ride {
  id: string;
  title: string;
  driverName: string;
  driverRating: number;
  driverId: string;  // Add driver ID for ownership checks
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  pricePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  description: string;
  requestStatus: 'pending' | 'approved' | 'rejected' | null;
  requestId?: string | null;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(100);
  const [selectedSeats, setSelectedSeats] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [cachedRides, setCachedRides] = useState<Ride[]>([]);

  // Force refresh when component becomes focused (to show updated request status)
  useEffect(() => {
    const handleFocus = () => {
      fetchRides(true); // Force refresh
    };

    // Listen for when the screen comes into focus
    const focusListener = () => handleFocus();
    
    // For now, just refresh on mount and when user changes
    // The proper focus listener would need react-navigation setup
    return () => {};
  }, []);

  const dateFilters = [
    { id: 'all', label: 'All Rides' },
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'this_week', label: 'This Week' },
  ];

  useEffect(() => {
    // Only fetch rides when user is authenticated and component mounts
    // Don't auto-fetch on every user change to reduce API calls
    if (user && rides.length === 0) {
      fetchRides();
    }
  }, [user]);

  const fetchRides = async (forceRefresh = false) => {
    if (!user) {
      return;
    }

    // PERFORMANCE OPTIMIZATION - Use cache if data is fresh (10 seconds for request status)
    const now = Date.now();
    const cacheAge = now - lastFetchTime;
    const CACHE_DURATION = 10 * 1000; // Reduced to 10 seconds to pick up status changes faster

    if (!forceRefresh && cacheAge < CACHE_DURATION && cachedRides.length > 0) {
      setRides(cachedRides);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      
      // PROPER APP: Build filters object - only future rides from other users
      const searchFilters: any = {
        status: 'active',
        limit: 50,
        offset: 0,
        exclude_own_rides: true  // Exclude user's own rides
      };
      
      

      // Additional filters can be added here if needed in the future

      // Use the centralized API client with filters
      
      const serverRides = await rideApi.getRides(searchFilters);

      if (!Array.isArray(serverRides)) {
        throw new Error('Invalid response format from server');
      }

      // Filter out user's own rides as a safety measure (server should already do this)
      const otherUsersRides = serverRides.filter((ride: any) => {
        const isOwnRide = ride.driver_id === user.id;
        if (isOwnRide) {
        }
        return !isOwnRide;
      });


      // ROBUST RIDE MAPPING - Handle any missing fields
      const formattedRides: Ride[] = otherUsersRides.map((ride: any, index: number) => {
        
        const formatted = {
          id: ride.id || `missing-id-${index}`,
          title: ride.title || 'No Title',
          driverName: ride.driver_name || 'Driver',
          driverRating: ride.driver_rating || 4.5,
          driverId: ride.driver_id || '',
          departureLocation: ride.departure_location || 'Unknown Location',
          destinationLocation: ride.destination_location || 'Unknown Destination',
          departureDate: ride.departure_date || new Date().toISOString().split('T')[0],
          departureTime: ride.departure_time || '00:00:00',
          pricePerSeat: parseFloat(ride.price_per_seat) || 0,
          availableSeats: parseInt(ride.available_seats) || 0,
          totalSeats: parseInt(ride.total_seats) || 0,
          description: ride.description || '',
          requestStatus: null,
        };
        
        // FIXED SEAT VALIDATION - Ensure available_seats never exceeds total_seats
        
        let seatsFixed = false;
        if (formatted.availableSeats > formatted.totalSeats) {
          formatted.availableSeats = formatted.totalSeats;
          seatsFixed = true;
        }
        
        // Ensure seats are never negative
        if (formatted.availableSeats < 0) {
          formatted.availableSeats = 0;
          seatsFixed = true;
        }
        
        if (seatsFixed) {
        }
        
        return formatted;
      });

      // Check request status for each ride to show proper button state
      const ridesWithStatus = await Promise.all(
        formattedRides.map(async (ride) => {
          try {
            const requestStatus = await rideApi.checkRequestStatus(ride.id);
            
            return {
              ...ride,
              requestStatus: requestStatus.has_requested ? (requestStatus.status as 'pending' | 'approved' | 'rejected') : null,
              requestId: requestStatus.request_id,
            };
          } catch (error: any) {
            console.warn(`⚠️ Could not check request status for ride ${ride.id}:`, error);
            
            // Check if it's an authentication error
            if (error.message && error.message.includes('403')) {
              console.error('🔐 SERVER ISSUE: Request status endpoint requires authentication fix');
            }
            
            return {
              ...ride,
              requestStatus: null,
              requestId: null,
            };
          }
        })
      );

      // FORCE TEST RIDE if no data (for debugging)
      if (ridesWithStatus.length === 0) {
      }
      
      setRides(ridesWithStatus);
      setCachedRides(ridesWithStatus); // Cache the results
      setLastFetchTime(Date.now()); // Update cache timestamp
      
      // Force loading to false
      setLoading(false);
      setRefreshing(false);
      
    } catch (error: any) {
      console.error('❌ Failed to fetch rides:', error);
      
      let errorMessage = 'Unable to load rides';
      if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('server')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication error. Please sign in again.';
      }
      
      Alert.alert('Error Loading Rides', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides(true); // Force refresh bypasses cache
  };

  const applyFilters = () => {
    setFiltersApplied(true);
    setShowAdvancedFilters(false);
  };

  const clearAllFilters = () => {
    setSelectedSeats(null);
    setSelectedTime(null);
    setMaxPrice(100);
    setSelectedRating(null);
    setSelectedFilter('all');
    setFiltersApplied(false);
  };


  const filteredRides = rides.filter(ride => {
    // Search filter - always apply when user types
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

    // Only apply other filters if they have been explicitly applied or a date filter is selected
    if (!filtersApplied && selectedFilter === 'all') {
      return true; // Show all rides when no filters are applied
    }

    // Price filter - only apply if filters are applied
    if (filtersApplied && ride.pricePerSeat > maxPrice) {
      return false;
    }

    // Seats filter - only apply if filters are applied
    if (filtersApplied && selectedSeats && ride.availableSeats < selectedSeats) {
      return false;
    }

    // Rating filter - only apply if filters are applied
    if (filtersApplied && selectedRating && ride.driverRating < selectedRating) {
      return false;
    }

    // Time filter - only apply if filters are applied
    if (filtersApplied && selectedTime) {
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

    // Date filter - apply when user clicks date filter chips
    if (selectedFilter !== 'all') {
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
    }

    return true;
  });

  // Apply filters to rides

  const handleRequestRide = (ride: Ride) => {
    // Prevent any state updates that might interfere
    setSelectedRide(ride);
    setShowRequestModal(true);
  };

  const handleCloseModal = () => {
    setShowRequestModal(false);
    // Don't clear selectedRide immediately to prevent race conditions
    setTimeout(() => {
      setSelectedRide(null);
    }, 300);
  };

  const handleSendRequest = async (message: string) => {
    if (!selectedRide || !user) return;

    try {
      setRequesting(true);

      // Send ride request to server with proper seat validation
      const result = await rideApi.requestRide(selectedRide.id, 1); // Request 1 seat by default
      
      
      // Show success dropdown notification
      Alert.alert(
        '🎉 Request Sent Successfully!',
        result.message || 'Your ride request has been sent to the driver. You\'ll be notified when they respond.',
        [{ text: 'Awesome!' }]
      );
      
      // Show in-app notification toast
      sendNotification({
        title: 'Ride Request Sent! 🎫',
        message: `Your request to join "${selectedRide.title}" has been sent to the driver`,
        type: 'success'
      });
      
      // Create database notification for the passenger (appears in notifications page)
      try {
        await notifyRideRequestSent(
          user.id, // passenger ID (current user)
          selectedRide.driverName, // driver name
          selectedRide.title, // ride title
          selectedRide.id, // ride ID
          result.request_id // request ID
        );
      } catch (notifError) {
        console.error('❌ Failed to create passenger notification:', notifError);
        // Don't fail the request if notification creation fails
      }
      
      // Update the ride's request status locally - FORCE UPDATE
      setRides(prevRides => {
        const updatedRides = prevRides.map(ride => 
          ride.id === selectedRide.id 
            ? { 
                ...ride, 
                requestStatus: 'pending' as const,
                requestId: result.request_id
              }
            : ride
        );
        if (__DEV__) {
          console.log('🔄 SEARCH: Updated ride request status');
        }
        return updatedRides;
      });
      
      setShowRequestModal(false);
      setSelectedRide(null);
      
      if (__DEV__) {
        console.log('🔔 SEARCH: Ride request sent successfully');
      }
      
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ SEARCH: Failed to send request');
      }
      
      let errorMessage = 'Failed to send ride request. Please try again.';
      
      // Check for specific error types
      if (error.message) {
        if (error.message.includes('Not enough seats')) {
          errorMessage = 'This ride is fully booked. No seats available.';
        } else if (error.message.includes('Cannot request your own ride')) {
          errorMessage = 'You cannot request your own ride.';
        } else if (error.message.includes('already have a pending request')) {
          errorMessage = 'You already have a pending request for this ride.';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. The request may have been saved. Please refresh and check.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // If the request actually succeeded but there was a notification error, don't show error
      if (error.message && error.message.includes('notification') && !error.message.includes('request')) {
        if (__DEV__) {
          console.log('⚠️ SEARCH: Request succeeded but notification failed');
        }
        return;
      }
      
      Alert.alert('❌ Request Failed', errorMessage);
    } finally {
      setRequesting(false);
    }
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
              {item.availableSeats}/{item.totalSeats} seats
            </Text>
          </View>
        </View>

        {/* Safety check: Don't show request button for user's own rides */}
        {item.driverId === user?.id ? (
          <View style={styles.ownRideButton}>
            <Text style={styles.ownRideText}>Your Ride</Text>
          </View>
        ) : item.requestStatus === 'pending' ? (
          <View style={styles.pendingButton}>
            <View style={styles.pendingButtonContent}>
              <View style={styles.pendingIcon}>
                <Text style={styles.pendingIconText}>⏳</Text>
              </View>
              <View style={styles.pendingTextContainer}>
                <Text style={styles.pendingTitle}>Request Sent</Text>
                <Text style={styles.pendingSubtitle}>Waiting for response</Text>
              </View>
            </View>
          </View>
        ) : item.requestStatus === 'approved' ? (
          <View style={styles.approvedButton}>
            <View style={styles.approvedButtonContent}>
              <View style={styles.approvedIcon}>
                <Text style={styles.approvedIconText}>✓</Text>
              </View>
              <View style={styles.approvedTextContainer}>
                <Text style={styles.approvedTitle}>Request Approved!</Text>
                <Text style={styles.approvedSubtitle}>You can join this ride</Text>
              </View>
            </View>
          </View>
        ) : item.requestStatus === 'rejected' ? (
          <View style={styles.rejectedButton}>
            <View style={styles.rejectedButtonContent}>
              <View style={styles.rejectedIcon}>
                <Text style={styles.rejectedIconText}>✕</Text>
              </View>
              <View style={styles.rejectedTextContainer}>
                <Text style={styles.rejectedTitle}>Request Declined</Text>
                <Text style={styles.rejectedSubtitle}>Try other rides</Text>
              </View>
            </View>
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
          {dateFilters.map((filter) => (
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
              contentContainerStyle={styles.filtersScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
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
                    <Text style={styles.sliderLabel}>$0</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
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
          contentContainerStyle={[styles.ridesList, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🚗</Text>
              <Text style={styles.emptyStateTitle}>No rides available</Text>
              <Text style={styles.emptyStateText}>
                No future rides found. Create a ride to get started or check back later!
              </Text>
            </View>
          }
        />
      )}

      {selectedRide && (
        <RequestMessageModal
          visible={showRequestModal}
          onClose={handleCloseModal}
          onSendRequest={handleSendRequest}
          driverName={selectedRide.driverName}
          rideTitle={selectedRide.title}
          pricePerSeat={selectedRide.pricePerSeat}
          loading={requesting}
        />
      )}
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
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      8,
      3
    ),
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
  ownRideButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.border + '30',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ownRideText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
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
  requestedButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00' + '20', // Orange background with transparency
    borderWidth: 1,
    borderColor: '#FF8C00', // Orange border
  },
  requestedButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#FF8C00', // Orange text
  },
  // Modern Pending Button Styles
  pendingButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FEF3C7', // Light amber background
    borderWidth: 1,
    borderColor: '#F59E0B', // Amber border
  },
  pendingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  pendingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconText: {
    fontSize: 12,
  },
  pendingTextContainer: {
    alignItems: 'center',
  },
  pendingTitle: {
    color: '#92400E', // Dark amber
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingSubtitle: {
    color: '#A16207', // Medium amber
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  // Modern Approved Button Styles
  approvedButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#10B981', // Modern green
    ...getShadowStyle(
      '#10B981',
      { width: 0, height: 4 },
      0.3,
      8,
      6
    ),
  },
  approvedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  approvedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvedIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  approvedTextContainer: {
    alignItems: 'center',
  },
  approvedTitle: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  approvedSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  // Modern Rejected Button Styles
  rejectedButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#F3F4F6', // Light gray background
    borderWidth: 1,
    borderColor: '#EF4444', // Red border
  },
  rejectedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  rejectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2', // Light red background
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedIconText: {
    color: '#EF4444', // Red color
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectedTextContainer: {
    alignItems: 'center',
  },
  rejectedTitle: {
    color: '#EF4444', // Red color
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  rejectedSubtitle: {
    color: '#6B7280', // Gray color
    fontSize: FontSize.xs,
    fontWeight: '500',
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
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.08,
      8,
      3
    ),
    maxHeight: 400, // Limit height to ensure buttons are accessible
  },
  filtersScrollContainer: {
    maxHeight: 300, // Allow scrolling within this height
  },
  filtersScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
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
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
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
