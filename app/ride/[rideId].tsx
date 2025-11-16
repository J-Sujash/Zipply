import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { notifyRideRequest, notifyRideRequestSent, notifyPassengerLeft } from '../../lib/notifications';
import { rideApi } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
    ArrowLeftIcon,
    CalendarIcon,
    CarIcon,
    ClockIcon,
    MapPinIcon,
    MessageIcon,
    StarIcon,
    TimeIcon,
    UserIcon,
    UsersIcon
} from '../../components/ui/Icons';
import { RequestMessageModal } from '../../components/ui/RequestMessageModal';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';
import { getOrCreateConversation } from '../../lib/messaging';
import { isMessagingDisabled } from '../../lib/messagingService';

interface RideDetails {
  id: string;
  title: string;
  description?: string;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  estimatedDuration?: number;
  totalSeats: number;
  availableSeats: number;
  pricePerSeat: number;
  requirements?: string;
  status: 'active' | 'completed' | 'cancelled';
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    rating: number;
    totalRidesAsDriver: number;
    phoneNumber?: string;
    schoolEmail: string;
  };
  vehicle?: {
    make: string;
    model: string;
    year: number;
    color: string;
    license_plate: string;
    seats: number;
  };
  passengers: {
    id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
    seatsRequested: number;
  }[];
  userRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  userRequestId?: string; // ID of the user's ride request
}

const { width } = Dimensions.get('window');

// Utility function to get color from name
const getColorFromName = (colorName: string): string => {
  const colorMap: { [key: string]: string } = {
    'red': '#EF4444',
    'blue': '#3B82F6',
    'green': '#10B981',
    'yellow': '#F59E0B',
    'purple': '#8B5CF6',
    'pink': '#EC4899',
    'gray': '#6B7280',
    'grey': '#6B7280',
    'black': '#1F2937',
    'white': '#F9FAFB',
    'silver': '#9CA3AF',
    'gold': '#F59E0B',
    'orange': '#F97316',
    'brown': '#92400E',
    'beige': '#D6D3D1',
    'maroon': '#7F1D1D',
    'navy': '#1E3A8A',
  };
  
  const normalizedColor = colorName.toLowerCase().trim();
  return colorMap[normalizedColor] || Colors.accent;
};

export default function RideDetailsScreen() {
  const { user } = useAuth();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId]);

  // Prevent multiple rapid fetches
  const [isFetching, setIsFetching] = useState(false);

  const fetchRideDetails = async () => {
    if (!rideId || isFetching) return;

    try {
      setIsFetching(true);
      setError(null);
      
      // Fetch ride details with driver info and vehicle info
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey (
            id,
            first_name,
            last_name,
            profile_picture_url,
            rating,
            total_rides_as_driver,
            phone_number,
            school_email
          ),
          vehicle:vehicles!rides_vehicle_id_fkey (
            make,
            model,
            year,
            color,
            license_plate,
            seats
          )
        `)
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      
      // Debug: Log the fetched data to see vehicle information (only if there are issues)
      if (!rideData.vehicle && rideData.vehicle_id) {
        console.warn('⚠️ Ride has vehicle_id but no vehicle data:', {
          rideId: rideData.id,
          vehicleId: rideData.vehicle_id,
          title: rideData.title
        });
      }

      // Fetch approved passengers
      const { data: passengersData, error: passengersError } = await supabase
        .from('ride_requests')
        .select(`
          seats_requested,
          passenger:profiles!ride_requests_passenger_id_fkey (
            id,
            first_name,
            last_name,
            profile_picture_url
          )
        `)
        .eq('ride_id', rideId)
        .eq('status', 'approved');

      if (passengersError) throw passengersError;

      // Check user's request status if logged in
      let userRequestStatus = 'none';
      let userRequestId: string | undefined;
      if (user) {
        const { data: requestData } = await supabase
          .from('ride_requests')
          .select('id, status')
          .eq('ride_id', rideId)
          .eq('passenger_id', user.id)
          .single();

        if (requestData) {
          userRequestStatus = requestData.status;
          userRequestId = requestData.id;
        }
      }

      const formattedRide: RideDetails = {
        id: rideData.id,
        title: rideData.title,
        description: rideData.description,
        departureLocation: rideData.departure_location,
        destinationLocation: rideData.destination_location,
        departureDate: rideData.departure_date,
        departureTime: rideData.departure_time,
        estimatedDuration: rideData.estimated_duration_minutes,
        totalSeats: rideData.total_seats,
        availableSeats: rideData.available_seats,
        pricePerSeat: rideData.price_per_seat,
        requirements: rideData.requirements,
        status: rideData.status,
        driver: {
          id: rideData.driver.id,
          firstName: rideData.driver.first_name,
          lastName: rideData.driver.last_name,
          profilePictureUrl: rideData.driver.profile_picture_url,
          rating: rideData.driver.rating,
          totalRidesAsDriver: rideData.driver.total_rides_as_driver,
          phoneNumber: rideData.driver.phone_number,
          schoolEmail: rideData.driver.school_email,
        },
        vehicle: rideData.vehicle ? {
          make: rideData.vehicle.make || 'Unknown',
          model: rideData.vehicle.model || 'Vehicle',
          year: rideData.vehicle.year || new Date().getFullYear(),
          color: rideData.vehicle.color || 'Unknown',
          license_plate: rideData.vehicle.license_plate || 'N/A',
          seats: rideData.vehicle.seats || 4,
        } : undefined,
        passengers: (passengersData || []).map((p: any) => ({
          id: p.passenger.id,
          firstName: p.passenger.first_name,
          lastName: p.passenger.last_name,
          profilePictureUrl: p.passenger.profile_picture_url,
          seatsRequested: p.seats_requested,
        })),
        userRequestStatus: userRequestStatus as any,
        userRequestId,
      };

      setRide(formattedRide);
    } catch (error: any) {
      console.error('Error fetching ride details:', error);
      setError(error.message || 'Failed to load ride details');
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  const handleJoinRide = async () => {
    if (!user || !ride) return;

    if (ride.driver.id === user.id) {
      Alert.alert('Cannot Join', 'You cannot join your own ride.');
      return;
    }

    if (ride.userRequestStatus === 'pending') {
      Alert.alert('Request Pending', 'You already have a pending request for this ride.');
      return;
    }

    setShowRequestModal(true);
  };

  const handleSendRequest = async (message: string) => {
    if (!user || !ride) return;

    try {
      setRequesting(true);
      
      console.log('🚀 Sending ride request from ride details...');
      
      // Insert the ride request
      const { data: requestData, error } = await supabase
        .from('ride_requests')
        .insert({
          ride_id: ride.id,
          passenger_id: user.id,
          seats_requested: 1,
          message: message || `Hi ${ride.driver.firstName}, I'd like to join your ride!`,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log('✅ Request created with ID:', requestData.id);

      // Get user profile for passenger name
      const { data: passengerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      const passengerName = passengerProfile 
        ? `${passengerProfile.first_name} ${passengerProfile.last_name}`
        : 'Someone';
      
      const driverName = `${ride.driver.firstName} ${ride.driver.lastName}`;

      console.log('📧 Sending notifications...');

      // Send notification to driver
      const driverNotification = await notifyRideRequest(
        ride.driver.id,
        passengerName,
        ride.title,
        ride.id,
        requestData.id
      );

      // Send notification to requester (passenger)
      const passengerNotification = await notifyRideRequestSent(
        user.id,
        driverName,
        ride.title,
        ride.id,
        requestData.id
      );

      console.log('📧 Notification results:', {
        driverNotification: driverNotification.error ? 'Failed' : 'Success',
        passengerNotification: passengerNotification.error ? 'Failed' : 'Success'
      });

      Alert.alert('Success', 'Your ride request has been sent!');
      setShowRequestModal(false);
      // Refresh ride details to update status
      fetchRideDetails();
    } catch (error: any) {
      console.error('Error requesting ride:', error);
      Alert.alert('Error', error.message || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleMessageDriver = async () => {
    if (!ride || !user) {
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
      return;
    }

    try {
      // First check if messaging is disabled for this ride (45+ minutes after start)
      const messagingStatus = await isMessagingDisabled(ride.id);
      
      if (messagingStatus.disabled) {
        Alert.alert(
          'Messaging Unavailable', 
          messagingStatus.reason || 'Messaging is no longer available for this ride.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if user has an approved request for this ride
      const { data: userRequest, error: requestError } = await supabase
        .from('ride_requests')
        .select('id, status')
        .eq('ride_id', ride.id)
        .eq('passenger_id', user.id)
        .eq('status', 'approved')
        .single();

      if (requestError && requestError.code !== 'PGRST116') {
        throw requestError;
      }

      if (!userRequest) {
        Alert.alert(
          'Message Unavailable', 
          'You can only message the driver after your ride request has been approved.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create or get existing conversation
      const conversationId = await getOrCreateConversation(
        ride.id,
        ride.driver.id,
        user.id
      );

      // Navigate to the chat
      router.push(`/messages/${conversationId}`);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handleMessagePassenger = async (passengerId: string) => {
    if (!ride || !user) {
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
      return;
    }

    try {
      // Only drivers can message passengers
      if (ride.driver.id !== user.id) {
        Alert.alert('Error', 'Only the driver can message passengers.');
        return;
      }

      // Create or get existing conversation
      const conversationId = await getOrCreateConversation(
        ride.id,
        user.id, // driver
        passengerId // passenger
      );

      // Navigate to the chat
      router.push(`/messages/${conversationId}`);
    } catch (error: any) {
      console.error('Error starting conversation with passenger:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handleLeaveRide = async () => {
    if (!user || !ride || !ride.userRequestId) return;

    Alert.alert(
      'Leave Ride',
      'Are you sure you want to leave this ride? The seat will be made available for other passengers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeaving(true);

              // Get passenger name for notification
              const { data: passengerProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

              const passengerName = passengerProfile
                ? `${passengerProfile.first_name} ${passengerProfile.last_name}`
                : 'A passenger';

              // Get the request to find seats requested
              const { data: requestData, error: requestError } = await supabase
                .from('ride_requests')
                .select('seats_requested')
                .eq('id', ride.userRequestId)
                .single();

              if (requestError) throw requestError;

              const seatsRequested = requestData?.seats_requested || 1;

              // Try to use server API first, fallback to direct Supabase
              try {
                const result = await rideApi.leaveRide(ride.userRequestId);
                console.log('✅ Left ride via server:', result);
              } catch (apiError: any) {
                console.log('⚠️ Server API failed, using direct Supabase:', apiError.message);
                
                // Fallback: Direct Supabase implementation
                // Delete the ride request
                const { error: deleteError } = await supabase
                  .from('ride_requests')
                  .delete()
                  .eq('id', ride.userRequestId);

                if (deleteError) throw deleteError;

                // Update available seats using RPC or increment
                const { data: currentRide, error: fetchError } = await supabase
                  .from('rides')
                  .select('available_seats')
                  .eq('id', ride.id)
                  .single();

                if (fetchError) throw fetchError;

                const newAvailableSeats = (currentRide?.available_seats || 0) + seatsRequested;

                const { error: updateError } = await supabase
                  .from('rides')
                  .update({
                    available_seats: newAvailableSeats,
                  })
                  .eq('id', ride.id);

                if (updateError) throw updateError;
              }

              // Send notification to driver
              await notifyPassengerLeft(
                ride.driver.id,
                passengerName,
                ride.title,
                ride.id,
                ride.userRequestId
              );

              Alert.alert(
                'Ride Left',
                'You have successfully left the ride. The seat has been made available again.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.back();
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error leaving ride:', error);
              Alert.alert('Error', error.message || 'Failed to leave ride. Please try again.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
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

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            size={14}
            color={star <= rating ? Colors.warning : Colors.border}
            filled={star <= rating}
          />
        ))}
      </View>
    );
  };

  const getRequestButtonText = () => {
    switch (ride?.userRequestStatus) {
      case 'pending':
        return 'Request Pending';
      case 'approved':
        return 'Leave Ride';
      case 'rejected':
        return 'Request Rejected';
      default:
        return 'Join Ride';
    }
  };

  const isRequestDisabled = () => {
    return (
      !user ||
      !ride ||
      ride.driver.id === user.id ||
      ride.availableSeats === 0 ||
      ride.userRequestStatus !== 'none' ||
      requesting
    );
  };

  const shouldShowLeaveButton = () => {
    return ride?.userRequestStatus === 'approved' && user && ride.userRequestId;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Ride not found'}
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackButton}
        >
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ride Title */}
        <Card variant="elevated" style={styles.titleCard}>
          <Text style={styles.rideTitle}>{ride.title}</Text>
          {ride.description && (
            <Text style={styles.rideDescription}>{ride.description}</Text>
          )}
        </Card>

        {/* Route Information */}
        <Card variant="elevated" style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <MapPinIcon size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Route</Text>
          </View>
          
          <View style={styles.routeContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, styles.departureDot]} />
              <Text style={styles.locationText}>{ride.departureLocation}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, styles.destinationDot]} />
              <Text style={styles.locationText}>{ride.destinationLocation}</Text>
            </View>
          </View>
        </Card>

        {/* Date & Time */}
        <Card variant="elevated" style={styles.timeCard}>
          <View style={styles.timeHeader}>
            <ClockIcon size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>
          
          <View style={styles.timeContainer}>
            <View style={styles.timeItem}>
              <CalendarIcon size={18} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{formatDate(ride.departureDate)}</Text>
            </View>
            <View style={styles.timeItem}>
              <TimeIcon size={18} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{formatTime(ride.departureTime)}</Text>
            </View>
            {ride.estimatedDuration && (
              <View style={styles.timeItem}>
                <ClockIcon size={18} color={Colors.textSecondary} />
                <Text style={styles.timeText}>{ride.estimatedDuration} min trip</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Driver Information */}
        <Card variant="elevated" style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <UserIcon size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Driver</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.driverInfo}
            onPress={() => router.push({ pathname: '/ratings/[userId]', params: { userId: ride.driver.id } })}
          >
            <View style={styles.driverAvatar}>
              {ride.driver.profilePictureUrl ? (
                <Image 
                  source={{ uri: ride.driver.profilePictureUrl }} 
                  style={styles.avatarImage}
                />
              ) : (
                <UserIcon size={24} color={Colors.white} />
              )}
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>
                {ride.driver.firstName} {ride.driver.lastName}
              </Text>
              <View style={styles.driverRating}>
                {renderStars(Math.round(ride.driver.rating))}
                <Text style={styles.ratingText}>
                  {ride.driver.rating.toFixed(1)} • {ride.driver.totalRidesAsDriver} rides
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.messageButton}
              onPress={handleMessageDriver}
            >
              <MessageIcon size={18} color={Colors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Card>

        {/* Vehicle Information */}
        <Card variant="elevated" style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleHeaderLeft}>
              <CarIcon size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Driver's Vehicle</Text>
            </View>
          </View>
          
          {ride.vehicle ? (
            <View style={styles.vehicleContent}>
              {/* Main Vehicle Display */}
              <View style={styles.vehicleMainInfo}>
                <View style={styles.vehicleIconContainer}>
                  <CarIcon size={32} color={Colors.white} />
                </View>
                
                <View style={styles.vehicleDetails}>
                  <Text style={styles.vehicleName}>
                    {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model}
                  </Text>
                  
                  <View style={styles.vehicleColorContainer}>
                    <View style={[styles.colorDot, { backgroundColor: getColorFromName(ride.vehicle.color) }]} />
                    <Text style={styles.vehicleColor}>{ride.vehicle.color}</Text>
                  </View>
                </View>
              </View>

              {/* Detailed Vehicle Specs */}
              <View style={styles.vehicleSpecs}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Year</Text>
                  <View style={styles.specValueContainer}>
                    <Text style={styles.specValue}>{ride.vehicle.year}</Text>
                  </View>
                </View>
                
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Brand</Text>
                  <View style={styles.specValueContainer}>
                    <Text style={styles.specValue}>{ride.vehicle.make}</Text>
                  </View>
                </View>
                
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Model</Text>
                  <View style={styles.specValueContainer}>
                    <Text style={styles.specValue}>{ride.vehicle.model}</Text>
                  </View>
                </View>
                
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Color</Text>
                  <View style={styles.specValueContainer}>
                    <View style={[styles.colorIndicator, { backgroundColor: getColorFromName(ride.vehicle.color) }]} />
                    <Text style={styles.specValue}>{ride.vehicle.color}</Text>
                  </View>
                </View>
              </View>

              {/* Vehicle Capacity */}
              <View style={styles.vehicleCapacity}>
                <UsersIcon size={16} color={Colors.primary} />
                <Text style={styles.capacityText}>{ride.vehicle.seats} seats total</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noVehicleInfo}>
              <CarIcon size={32} color={Colors.textSecondary} />
              <Text style={styles.noVehicleText}>Vehicle information not available</Text>
              <Text style={styles.noVehicleSubtext}>The driver hasn't added vehicle details yet</Text>
            </View>
          )}
        </Card>

        {/* Seats & Price */}
        <Card variant="elevated" style={styles.seatsCard}>
          <View style={styles.seatsHeader}>
            <UsersIcon size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Availability</Text>
          </View>
          
          <View style={styles.seatsContainer}>
            <View style={styles.seatInfo}>
              <Text style={styles.seatNumber}>{ride.availableSeats}</Text>
              <Text style={styles.seatLabel}>Available Seats</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceInfo}>
              <Text style={styles.priceNumber}>${ride.pricePerSeat}</Text>
              <Text style={styles.priceLabel}>Per Seat</Text>
            </View>
          </View>
        </Card>

        {/* Passengers */}
        <Card variant="elevated" style={styles.passengersCard}>
          <View style={styles.passengersHeader}>
            <View style={styles.passengersHeaderLeft}>
              <UsersIcon size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                Passengers ({ride.passengers.reduce((total, p) => total + p.seatsRequested, 0)}/{ride.totalSeats - 1})
              </Text>
            </View>
            {ride.passengers.length > 0 && (
              <View style={styles.passengersBadge}>
                <Text style={styles.passengersBadgeText}>
                  {ride.passengers.reduce((total, p) => total + p.seatsRequested, 0)} seats booked
                </Text>
              </View>
            )}
          </View>
          
          {ride.passengers.length > 0 ? (
            <>
              <View style={styles.passengersList}>
                {ride.passengers.map((passenger, index) => (
                  <View key={passenger.id} style={styles.passengerItem}>
                    <View style={styles.passengerLeft}>
                      <View style={styles.passengerAvatar}>
                        {passenger.profilePictureUrl ? (
                          <Image 
                            source={{ uri: passenger.profilePictureUrl }} 
                            style={styles.passengerAvatarImage}
                          />
                        ) : (
                          <UserIcon size={18} color={Colors.white} />
                        )}
                      </View>
                      <View style={styles.passengerInfo}>
                        <Text style={styles.passengerName}>
                          {passenger.firstName} {passenger.lastName}
                        </Text>
                        <View style={styles.passengerDetails}>
                          <View style={styles.seatsBadge}>
                            <UsersIcon size={12} color={Colors.primary} />
                            <Text style={styles.seatsText}>
                              {passenger.seatsRequested} seat{passenger.seatsRequested > 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.passengerActions}>
                      <View style={styles.approvedBadge}>
                        <Text style={styles.approvedText}>✓ Approved</Text>
                      </View>
                      {user && ride.driver.id === user.id && (
                        <TouchableOpacity 
                          style={styles.passengerMessageButton}
                          onPress={() => handleMessagePassenger(passenger.id)}
                        >
                          <MessageIcon size={16} color={Colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              
              {/* Show available seats info */}
              {ride.availableSeats > 0 && (
                <View style={styles.availableSeatsInfo}>
                  <View style={styles.availableSeatsIcon}>
                    <UsersIcon size={16} color={Colors.success} />
                  </View>
                  <Text style={styles.availableSeatsText}>
                    {ride.availableSeats} more seat{ride.availableSeats > 1 ? 's' : ''} available
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noPassengersState}>
              <View style={styles.noPassengersIcon}>
                <UsersIcon size={32} color={Colors.textSecondary} />
              </View>
              <Text style={styles.noPassengersTitle}>No passengers yet</Text>
              <Text style={styles.noPassengersText}>
                {user && ride.driver.id === user.id 
                  ? 'Passengers who join your ride will appear here'
                  : 'This ride is still looking for passengers'
                }
              </Text>
              {ride.availableSeats > 0 && (
                <View style={styles.availableSeatsInfo}>
                  <View style={styles.availableSeatsIcon}>
                    <UsersIcon size={16} color={Colors.success} />
                  </View>
                  <Text style={styles.availableSeatsText}>
                    {ride.availableSeats} seat{ride.availableSeats > 1 ? 's' : ''} available
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Requirements */}
        {ride.requirements && (
          <Card variant="elevated" style={styles.requirementsCard}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <Text style={styles.requirementsText}>{ride.requirements}</Text>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      {ride.status === 'active' && (
        <View style={styles.bottomContainer}>
          {shouldShowLeaveButton() ? (
            <Button
              title="Leave Ride"
              onPress={handleLeaveRide}
              loading={leaving}
              variant="outline"
              style={[styles.joinButton, styles.leaveButton]}
            />
          ) : (
            <Button
              title={getRequestButtonText()}
              onPress={handleJoinRide}
              disabled={isRequestDisabled()}
              loading={requesting}
              style={styles.joinButton}
            />
          )}
        </View>
      )}

      {/* Request Message Modal */}
      {ride && (
        <RequestMessageModal
          visible={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          onSendRequest={handleSendRequest}
          driverName={`${ride.driver.firstName} ${ride.driver.lastName}`}
          rideTitle={ride.title}
          pricePerSeat={ride.pricePerSeat}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBackButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100, // Space for bottom button
  },
  titleCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  rideTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  rideDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  routeCard: {
    marginBottom: Spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  routeContainer: {
    paddingLeft: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  departureDot: {
    backgroundColor: Colors.success,
  },
  destinationDot: {
    backgroundColor: Colors.error,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 5,
    marginVertical: 2,
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  timeCard: {
    marginBottom: Spacing.md,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  timeText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  driverCard: {
    marginBottom: Spacing.md,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: Spacing.sm,
  },
  ratingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Vehicle Information Styles
  vehicleCard: {
    marginBottom: Spacing.md,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  vehicleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleContent: {
    paddingTop: 0,
  },
  vehicleMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: FontSize.lg * 1.2,
  },
  vehicleColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    marginRight: Spacing.sm,
  },
  vehicleColor: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  noVehicleInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noVehicleText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noVehicleSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    opacity: 0.7,
  },
  compactVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  yearBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  brandBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  brandText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 1,
  },
  seatsCard: {
    marginBottom: Spacing.md,
  },
  seatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seatInfo: {
    flex: 1,
    alignItems: 'center',
  },
  seatNumber: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  seatLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  priceDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  priceInfo: {
    flex: 1,
    alignItems: 'center',
  },
  priceNumber: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.success,
  },
  priceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  passengersCard: {
    marginBottom: Spacing.md,
  },
  passengersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  passengersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengersBadge: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  passengersBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  passengersList: {
    gap: Spacing.md,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passengerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  passengerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  passengerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seatsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  seatsText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  passengerActions: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  approvedBadge: {
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  approvedText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
  },
  passengerMessageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSeatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  availableSeatsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  availableSeatsText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '500',
  },
  passengerSeats: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  noPassengersState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noPassengersIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  noPassengersTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  noPassengersText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  requirementsCard: {
    marginBottom: Spacing.md,
  },
  requirementsText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  joinButton: {
    width: '100%',
  },
  leaveButton: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  // Vehicle specification styles
  vehicleSpecs: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '30',
  },
  specLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  specValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vehicleCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    justifyContent: 'center',
  },
  capacityText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
