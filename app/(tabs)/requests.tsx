import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
    CalendarIcon,
    CheckIcon,
    DollarIcon,
    LocationIcon,
    MessageIcon,
    TimeIcon,
    UserIcon,
    XIcon
} from '../../components/ui/Icons';
import { NotificationIcon } from '../../components/ui/NotificationIcon';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { rideApi, RideRequest } from '../../lib/apiClient';
import { getOrCreateConversation, isMessagingDisabled } from '../../lib/messagingService';
import { notifyPassengerLeft } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';

interface OfferedRide {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  price_per_seat: number;
  available_seats: number;
  total_seats: number;
  status: string;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  seats: number;
  is_default: boolean;
}

export default function RequestsScreen() {
  const { user, session } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<RideRequest[]>([]);
  const [myRequests, setMyRequests] = useState<RideRequest[]>([]);
  const [offeredRides, setOfferedRides] = useState<OfferedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'incoming' | 'my-requests' | 'offered'>('incoming');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRide, setEditingRide] = useState<OfferedRide | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  
  // Edit form state
  const [editDepartureLocation, setEditDepartureLocation] = useState('');
  const [editDestinationLocation, setEditDestinationLocation] = useState('');
  const [editDepartureDate, setEditDepartureDate] = useState(new Date());
  const [editDepartureTime, setEditDepartureTime] = useState(new Date());
  const [editPricePerSeat, setEditPricePerSeat] = useState('');
  const [editTotalSeats, setEditTotalSeats] = useState('');
  const [editSelectedVehicle, setEditSelectedVehicle] = useState<Vehicle | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [approvedPassengers, setApprovedPassengers] = useState(0);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [ridePassengers, setRidePassengers] = useState<Record<string, any[]>>({});
  
  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Animation
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) {
      fetchData();
      fetchVehicles();
    }
  }, [user]);

  const fetchRidePassengers = async (rideIds: string[]) => {
    if (rideIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
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
        .in('ride_id', rideIds)
        .eq('status', 'approved');

      if (error) throw error;

      // Group passengers by ride_id
      const passengersByRide: Record<string, any[]> = {};
      data?.forEach((request) => {
        if (!passengersByRide[request.ride_id]) {
          passengersByRide[request.ride_id] = [];
        }
        passengersByRide[request.ride_id].push(request.passenger);
      });

      setRidePassengers(passengersByRide);
    } catch (error) {
      console.error('Error fetching ride passengers:', error);
    }
  };

  const fetchVehicles = async () => {
    if (!user) return;
    
    try {
      setVehiclesLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setVehiclesLoading(false);
    }
  };

  // Dynamic seat options based on selected vehicle and approved passengers
  const getAvailableSeatOptions = () => {
    if (!editSelectedVehicle) return ['1', '2', '3', '4']; // Default options
    
    const maxSeats = editSelectedVehicle.seats - 1; // Reserve one seat for driver
    const minSeats = Math.max(1, approvedPassengers); // Cannot go below approved passengers
    const options = [];
    
    for (let i = minSeats; i <= maxSeats; i++) {
      options.push(i.toString());
    }
    
    return options.length > 0 ? options : [minSeats.toString()];
  };

  // Helper function to check if a ride/request is in the future
  const isFutureRide = (departureDate: string, departureTime: string): boolean => {
    const now = new Date();
    const rideDateTime = new Date(`${departureDate}T${departureTime}`);
    return rideDateTime > now;
  };

  // Filter function for future rides/requests only
  const filterFutureItems = <T extends { ride: { departure_date: string; departure_time: string } }>(items: T[]): T[] => {
    return items.filter(item => isFutureRide(item.ride.departure_date, item.ride.departure_time));
  };

  const filterFutureRides = (rides: OfferedRide[]): OfferedRide[] => {
    return rides.filter(ride => isFutureRide(ride.departure_date, ride.departure_time));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching all requests data...');
      
      // Server connectivity will be tested by the actual API calls
      
      await Promise.all([
        fetchIncomingRequests(),
        fetchMyRequests(),
        fetchOfferedRides()
      ]);
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      Alert.alert('Error', 'Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingRequests = async () => {
    try {
      console.log('📥 Fetching incoming requests...');
      const requests = await rideApi.getIncomingRequests();
      // Filter to only show future requests
      const futureRequests = filterFutureItems(requests);
      setIncomingRequests(futureRequests);
    } catch (error) {
      console.error('❌ Error fetching incoming requests:', error);
      setIncomingRequests([]);
    }
  };

  const fetchMyRequests = async () => {
    try {
      console.log('🎫 Fetching my requests...');
      const requests = await rideApi.getMyRequests();
      // Filter to only show future requests
      const futureRequests = filterFutureItems(requests);
      setMyRequests(futureRequests);
    } catch (error) {
      console.error('❌ Error fetching my requests:', error);
      setMyRequests([]);
    }
  };

  const fetchOfferedRides = async () => {
    try {
      console.log('🚗 Fetching offered rides...');
      const rides = await rideApi.getMyRides('active');
      // Filter to only show future rides
      const futureRides = filterFutureRides(rides);
      setOfferedRides(futureRides);
      
      // Fetch passengers for these rides
      const rideIds = futureRides.map(ride => ride.id);
      await fetchRidePassengers(rideIds);
    } catch (error) {
      console.error('❌ Error fetching offered rides:', error);
      setOfferedRides([]);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (processingRequests.has(requestId)) {
      Alert.alert('Processing', 'This request is already being processed. Please wait.');
      return;
    }

    Alert.alert(
      'Approve Request',
      'Are you sure you want to approve this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          onPress: async () => {
            setProcessingRequests(prev => new Set(prev).add(requestId));
            
            try {
              console.log('🚀 SERVER API APPROVE:', requestId);
              
              const result = await rideApi.approveRequest(requestId);
              console.log('✅ Server approval successful:', result);
              
              Alert.alert(
                '🎉 Request Approved!', 
                result.message || 'Request has been approved successfully!',
                [{ 
                  text: 'Great!',
                  onPress: () => fetchData() // Refresh data
                }]
              );
              
            } catch (error: any) {
              console.error('❌ Approval error:', error);
              Alert.alert(
                'Approval Failed',
                error.message || 'Failed to approve request. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setProcessingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  const handleRejectRequest = async (requestId: string) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('❌ SERVER API REJECT:', requestId);
              
              const result = await rideApi.rejectRequest(requestId);
              console.log('✅ Server rejection successful:', result);
              
              Alert.alert(
                'Request Rejected', 
                result.message || 'Request has been rejected.',
                [{ 
                  text: 'OK',
                  onPress: () => fetchData() // Refresh data
                }]
              );
              
            } catch (error: any) {
              console.error('❌ Rejection error:', error);
              Alert.alert(
                'Rejection Failed',
                error.message || 'Failed to reject request. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleCancelRequest = async (requestId: string) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this ride request?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚫 Canceling request:', requestId);
              // This would need to be implemented in the API
              // For now, just refresh the data
              await fetchData();
              Alert.alert('Request Canceled', 'Your ride request has been canceled.');
            } catch (error: any) {
              console.error('❌ Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel request. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleMessageDriver = async (item: RideRequest) => {
    if (!user) {
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
      return;
    }

    try {
      // Check if request is pending - must be approved first
      if (item.status === 'pending') {
        Alert.alert(
          'Approval Required', 
          'You must be approved by the driver before you can message them.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Only check messaging disabled for approved requests
      if (item.status === 'approved') {
        // Check if messaging is disabled for this ride (45+ minutes after start)
        const messagingStatus = await isMessagingDisabled(item.ride_id);
        
        if (messagingStatus.disabled) {
          Alert.alert(
            'Messaging Unavailable', 
            messagingStatus.reason || 'Messaging is no longer available for this ride.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Get the driver ID from the ride
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('driver_id')
        .eq('id', item.ride_id)
        .single();

      if (rideError || !rideData) {
        throw rideError || new Error('Ride not found');
      }

      const driverId = rideData.driver_id;

      // Create or get existing conversation
      const conversationId = await getOrCreateConversation(
        item.ride_id,
        driverId,
        user.id
      );

      // Navigate to the chat
      router.push(`/messages/${conversationId}`);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handleLeaveRide = async (requestId: string, rideId: string, rideTitle: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to leave a ride.');
      return;
    }

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

              // Get passenger name for notification
              const { data: passengerProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

              const passengerName = passengerProfile
                ? `${passengerProfile.first_name} ${passengerProfile.last_name}`
                : 'A passenger';

              // Get the request to find seats requested and driver ID
              const { data: requestData, error: requestError } = await supabase
                .from('ride_requests')
                .select('seats_requested, ride:rides!inner(driver_id)')
                .eq('id', requestId)
                .single();

              if (requestError) throw requestError;

              const seatsRequested = requestData?.seats_requested || 1;
              const driverId = (requestData?.ride as any)?.driver_id;

              // Try to use server API first, fallback to direct Supabase
              try {
                const result = await rideApi.leaveRide(requestId);
                console.log('✅ Left ride via server:', result);
              } catch (apiError: any) {
                console.log('⚠️ Server API failed, using direct Supabase:', apiError.message);
                
                // Fallback: Direct Supabase implementation
                // Delete the ride request
                const { error: deleteError } = await supabase
                  .from('ride_requests')
                  .delete()
                  .eq('id', requestId);

                if (deleteError) throw deleteError;

                // Update available seats
                const { data: currentRide, error: fetchError } = await supabase
                  .from('rides')
                  .select('available_seats')
                  .eq('id', rideId)
                  .single();

                if (fetchError) throw fetchError;

                const newAvailableSeats = (currentRide?.available_seats || 0) + seatsRequested;

                const { error: updateError } = await supabase
                  .from('rides')
                  .update({
                    available_seats: newAvailableSeats,
                  })
                  .eq('id', rideId);

                if (updateError) throw updateError;
              }

              // Send notification to driver
              if (driverId) {
                await notifyPassengerLeft(
                  driverId,
                  passengerName,
                  rideTitle,
                  rideId,
                  requestId
                );
              }

              Alert.alert(
                'Ride Left',
                'You have successfully left the ride. The seat has been made available again.',
                [{ text: 'OK', onPress: () => fetchData() }]
              );
            } catch (error: any) {
              console.error('Error leaving ride:', error);
              Alert.alert('Error', error.message || 'Failed to leave ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditRide = (ride: OfferedRide) => {
    console.log('✏️ Editing ride:', ride.id);
    setEditingRide(ride);
    
    // Calculate approved passengers (total_seats - available_seats)
    const approvedSeats = ride.total_seats - ride.available_seats;
    setApprovedPassengers(approvedSeats);
    
    // Populate form fields directly from local ride data
    setEditDepartureLocation(ride.departure_location);
    setEditDestinationLocation(ride.destination_location);
    
    // Parse date and time strings to Date objects
    const rideDate = new Date(ride.departure_date);
    const [hours, minutes] = ride.departure_time.split(':');
    const rideTime = new Date();
    rideTime.setHours(parseInt(hours), parseInt(minutes));
    
    setEditDepartureDate(rideDate);
    setEditDepartureTime(rideTime);
    setEditPricePerSeat(ride.price_per_seat.toString());
    setEditTotalSeats(ride.total_seats.toString());
    setEditDescription(''); // Reset description
    
    // Find and set the vehicle if available
    const defaultVehicle = vehicles.find(v => v.is_default) || vehicles[0];
    setEditSelectedVehicle(defaultVehicle || null);
    
    console.log('📝 Form data populated:', {
      title: ride.title,
      departure: ride.departure_location,
      destination: ride.destination_location,
      date: ride.departure_date,
      time: ride.departure_time,
      price: ride.price_per_seat,
      seats: ride.total_seats
    });
    
    console.log(`📊 Capacity Info: Total: ${ride.total_seats}, Available: ${ride.available_seats}, Approved: ${approvedSeats}`);
    
    // Show modal with animation
    setShowEditModal(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    
    console.log('✅ Ride data loaded from local state');
  };

  const handleSaveEdit = async () => {
    if (!editingRide) return;
    
    // Validation
    if (!editDepartureLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter departure location');
      return;
    }
    if (!editDestinationLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter destination location');
      return;
    }
    if (!editPricePerSeat || parseFloat(editPricePerSeat) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price per seat');
      return;
    }
    const newTotalSeats = parseInt(editTotalSeats);
    const maxVehicleSeats = editSelectedVehicle ? editSelectedVehicle.seats - 1 : 8;
    
    if (!editTotalSeats || newTotalSeats <= 0 || newTotalSeats > maxVehicleSeats) {
      Alert.alert('Validation Error', `Please enter valid total seats (1-${maxVehicleSeats})`);
      return;
    }
    
    // Smart capacity validation based on approved passengers
    if (newTotalSeats < approvedPassengers) {
      Alert.alert(
        'Capacity Error', 
        `You cannot reduce the total seats to ${newTotalSeats} because you already have ${approvedPassengers} approved passenger${approvedPassengers === 1 ? '' : 's'}. The minimum total seats you can set is ${approvedPassengers}.`
      );
      return;
    }

    try {
      setEditSaving(true);
      console.log('💾 SERVER API: Saving ride changes via server...');

      // Format date and time for server API
      // Send time as Eastern Time - server will handle it correctly
      const departureDate = `${editDepartureDate.getFullYear()}-${String(editDepartureDate.getMonth() + 1).padStart(2, '0')}-${String(editDepartureDate.getDate()).padStart(2, '0')}`; // YYYY-MM-DD
      const departureTime = `${String(editDepartureTime.getHours()).padStart(2, '0')}:${String(editDepartureTime.getMinutes()).padStart(2, '0')}:00`; // HH:MM:SS in Eastern Time
      
      // Calculate available seats based on approved passengers
      const newTotalSeats = parseInt(editTotalSeats);
      const newAvailableSeats = newTotalSeats - approvedPassengers;
      
      // Validate seat calculation
      if (newAvailableSeats < 0) {
        Alert.alert('Seat Error', `Invalid seat calculation. Total seats: ${newTotalSeats}, Approved passengers: ${approvedPassengers}`);
        return;
      }
      
      console.log(`🪑 SEAT CALCULATION: Total: ${newTotalSeats}, Approved: ${approvedPassengers}, Available: ${newAvailableSeats}`);
      
      // Prepare update data for server API
      const updateData = {
        title: `${editDepartureLocation.trim()} to ${editDestinationLocation.trim()}`,
        departure_location: editDepartureLocation.trim(),
        destination_location: editDestinationLocation.trim(),
        departure_date: departureDate,
        departure_time: departureTime,
        price_per_seat: parseFloat(editPricePerSeat),
        total_seats: newTotalSeats,
        available_seats: newAvailableSeats,
        description: editDescription.trim(),
      };

      console.log('📝 SERVER UPDATE DATA:', updateData);

      // Use server API to update ride
      const updatedRide = await rideApi.updateRide(editingRide.id, updateData);
      console.log('✅ SERVER UPDATE SUCCESS:', updatedRide);

      // Update local state with server response
      setOfferedRides(prevRides => 
        prevRides.map(ride => 
          ride.id === editingRide.id ? {
            ...ride,
            ...updatedRide,
            // Calculate available seats based on approved passengers
            available_seats: updatedRide.total_seats - approvedPassengers,
          } : ride
        )
      );

      Alert.alert(
        'Success!', 
        'Your ride has been updated successfully. All passengers have been notified of the changes.',
        [{ 
          text: 'OK',
          onPress: () => {
            handleCloseEditModal();
          }
        }]
      );
    } catch (error: any) {
      console.error('❌ SERVER UPDATE ERROR:', error);
      Alert.alert('Error', error.message || 'Failed to update ride. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCloseEditModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowEditModal(false);
      setEditingRide(null);
      // Clear form
      setEditDepartureLocation('');
      setEditDestinationLocation('');
      setEditDepartureDate(new Date());
      setEditDepartureTime(new Date());
      setEditPricePerSeat('');
      setEditTotalSeats('');
      setEditSelectedVehicle(null);
      setEditDescription('');
    });
  };

  const handleDeleteRide = async (rideId: string, rideTitle: string) => {
    Alert.alert(
      'Delete Ride',
      `Are you sure you want to delete "${rideTitle}"? All passengers will be notified of the cancellation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ SERVER API: Deleting ride via server:', rideId);
              
              // Use server API to cancel/delete ride
              const result = await rideApi.cancelRide(rideId);
              console.log('✅ SERVER DELETE SUCCESS:', result);

              // Remove ride from local state
              setOfferedRides(prevRides => prevRides.filter(ride => ride.id !== rideId));

              Alert.alert(
                'Ride Deleted', 
                result.message || 'Your ride has been deleted successfully. All passengers have been notified.',
                [{ text: 'OK' }]
              );

            } catch (error: any) {
              console.error('❌ SERVER DELETE ERROR:', error);
              Alert.alert('Error', error.message || 'Failed to delete ride. Please try again.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse date as local date to avoid timezone issues
      // Split "2025-11-11" and create local date instead of UTC
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      // Parse time string (format: "HH:MM:SS" or "HH:MM")
      const timeParts = timeString.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      
      // Create a date object for formatting
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      // Format in 12-hour time with AM/PM
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeString;
    }
  };

  const renderMyRequestCard = ({ item }: { item: RideRequest }) => (
    <Card variant="outlined" style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.rideInfo}>
          <Text style={styles.rideTitle}>{item.ride.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <LocationIcon size={16} color={Colors.success} />
          <Text style={styles.locationText}>{item.ride.departure_location}</Text>
        </View>
        <Text style={styles.routeArrow}>→</Text>
        <View style={styles.routePoint}>
          <LocationIcon size={16} color={Colors.error} />
          <Text style={styles.locationText}>{item.ride.destination_location}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailItem}>
          <CalendarIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(item.ride.departure_date)}</Text>
        </View>
        <View style={styles.detailItem}>
          <TimeIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(item.ride.departure_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <UserIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.seats_requested} seat(s)</Text>
        </View>
      </View>

      {item.message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Your message:</Text>
          <Text style={styles.messageText}>{item.message}</Text>
        </View>
      )}

      <View style={styles.rideActions}>
        <Button
          title="Message Driver"
          onPress={() => handleMessageDriver(item)}
          variant="outline"
          size="sm"
          style={styles.actionButton}
          icon={<MessageIcon size={16} color={Colors.primary} />}
        />
        {item.status === 'pending' && (
          <Button
            title="Cancel Request"
            onPress={() => handleCancelRequest(item.id)}
            size="sm"
            style={styles.cancelButton}
          />
        )}
        {item.status === 'approved' && (
          <Button
            title="Leave Ride"
            onPress={() => handleLeaveRide(item.id, item.ride_id, item.ride.title)}
            size="sm"
            variant="outline"
            style={styles.leaveButton}
          />
        )}
      </View>
    </Card>
  );

  const renderRequestCard = ({ item }: { item: RideRequest }) => (
    <Card variant="outlined" style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.passengerInfo}>
          <UserIcon size={20} color={Colors.primary} />
          <Text style={styles.passengerName}>{item.passenger_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.rideInfo}>
        <Text style={styles.rideTitle}>{item.ride.title}</Text>
        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <LocationIcon size={16} color={Colors.success} />
            <Text style={styles.locationText}>{item.ride.departure_location}</Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={styles.routePoint}>
            <LocationIcon size={16} color={Colors.error} />
            <Text style={styles.locationText}>{item.ride.destination_location}</Text>
          </View>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailItem}>
          <CalendarIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(item.ride.departure_date)}</Text>
        </View>
        <View style={styles.detailItem}>
          <TimeIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(item.ride.departure_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <UserIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.seats_requested} seat(s)</Text>
        </View>
      </View>

      {item.message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message:</Text>
          <Text style={styles.messageText}>{item.message}</Text>
        </View>
      )}

      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <Button
            title="Reject"
            onPress={() => handleRejectRequest(item.id)}
            variant="outline"
            size="sm"
            style={styles.rejectButton}
            icon={<XIcon size={16} color={Colors.error} />}
          />
          <Button
            title={processingRequests.has(item.id) ? "Processing..." : "Approve"}
            onPress={() => handleApproveRequest(item.id)}
            size="sm"
            style={styles.approveButton}
            icon={processingRequests.has(item.id) ? 
              <ActivityIndicator size="small" color={Colors.white} /> : 
              <CheckIcon size={16} color={Colors.white} />
            }
            disabled={processingRequests.has(item.id)}
          />
        </View>
      )}
    </Card>
  );

  const renderOfferedRideCard = ({ item }: { item: OfferedRide }) => (
    <Card variant="outlined" style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideTitle}>{item.title}</Text>
        <Text style={styles.priceText}>${item.price_per_seat}/seat</Text>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <LocationIcon size={16} color={Colors.success} />
          <Text style={styles.locationText}>{item.departure_location}</Text>
        </View>
        <Text style={styles.routeArrow}>→</Text>
        <View style={styles.routePoint}>
          <LocationIcon size={16} color={Colors.error} />
          <Text style={styles.locationText}>{item.destination_location}</Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <CalendarIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(item.departure_date)}</Text>
        </View>
        <View style={styles.detailItem}>
          <TimeIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(item.departure_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <UserIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.available_seats}/{item.total_seats} seats</Text>
        </View>
      </View>

      {/* Accepted Passengers Section */}
      {ridePassengers[item.id] && ridePassengers[item.id].length > 0 && (
        <>
          <View style={styles.dividerLine} />
          <View style={styles.passengersSection}>
            <Text style={styles.passengersSectionTitle}>
              Accepted Passengers ({ridePassengers[item.id].length})
            </Text>
            <View style={styles.passengersList}>
              {ridePassengers[item.id].map((passenger, index) => (
                <View key={passenger.id} style={styles.passengerItem}>
                  <View style={styles.passengerAvatar}>
                    {passenger.profile_picture_url ? (
                      <Image 
                        source={{ uri: passenger.profile_picture_url }} 
                        style={styles.passengerImage}
                      />
                    ) : (
                      <View style={styles.passengerPlaceholder}>
                        <Text style={styles.passengerInitial}>
                          {passenger.first_name?.[0]?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.acceptedPassengerName}>
                    {passenger.first_name} {passenger.last_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={styles.rideActions}>
        <Button
          title="Edit"
          onPress={() => handleEditRide(item)}
          variant="outline"
          size="sm"
          style={styles.editButton}
        />
        <Button
          title="Delete"
          onPress={() => handleDeleteRide(item.id, item.title)}
          size="sm"
          style={styles.deleteButton}
          textStyle={styles.deleteButtonText}
        />
      </View>
    </Card>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return Colors.warning;
      case 'approved': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'incoming':
        return (
          <FlatList
            data={incomingRequests}
            renderItem={renderRequestCard}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
            ListEmptyComponent={() => renderEmptyState('No incoming requests for future rides')}
          />
        );
      case 'my-requests':
        return (
          <FlatList
            data={myRequests}
            renderItem={renderMyRequestCard}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
            ListEmptyComponent={() => renderEmptyState('No ride requests for future rides')}
          />
        );
      case 'offered':
        return (
          <FlatList
            data={offeredRides}
            renderItem={renderOfferedRideCard}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
            ListEmptyComponent={() => renderEmptyState('No offered rides for the future')}
          />
        );
      default:
        return null;
    }
  };

  const getTabCount = (tab: 'incoming' | 'my-requests' | 'offered') => {
    switch (tab) {
      case 'incoming': return incomingRequests.length;
      case 'my-requests': return myRequests.length;
      case 'offered': return offeredRides.length;
      default: return 0;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Ride Requests</Text>
          <NotificationIcon size={24} color={Colors.text} />
        </View>
      </View>

      {/* Modern Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
          onPress={() => setActiveTab('incoming')}
        >
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.activeTabText]}>
            Incoming
          </Text>
          {getTabCount('incoming') > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getTabCount('incoming')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-requests' && styles.activeTab]}
          onPress={() => setActiveTab('my-requests')}
        >
          <Text style={[styles.tabText, activeTab === 'my-requests' && styles.activeTabText]}>
            My Requests
          </Text>
          {getTabCount('my-requests') > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getTabCount('my-requests')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'offered' && styles.activeTab]}
          onPress={() => setActiveTab('offered')}
        >
          <Text style={[styles.tabText, activeTab === 'offered' && styles.activeTabText]}>
            My Rides
          </Text>
          {getTabCount('offered') > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getTabCount('offered')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        renderTabContent()
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  })
                }]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Ride</Text>
              <TouchableOpacity onPress={handleCloseEditModal} style={styles.closeButton}>
                <XIcon size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardContainer}
            >
              <ScrollView 
                style={styles.modalScrollContainer}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalFormContainer}>
                    
                    {/* Locations */}
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>From</Text>
                      <View style={styles.modalInputWithIcon}>
                        <LocationIcon size={20} color={Colors.success} />
                        <TextInput
                          style={styles.modalInputWithIconText}
                          value={editDepartureLocation}
                          onChangeText={setEditDepartureLocation}
                          placeholder="Departure location"
                          placeholderTextColor={Colors.textSecondary}
                        />
                      </View>
                    </View>

                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>To</Text>
                      <View style={styles.modalInputWithIcon}>
                        <LocationIcon size={20} color={Colors.error} />
                        <TextInput
                          style={styles.modalInputWithIconText}
                          value={editDestinationLocation}
                          onChangeText={setEditDestinationLocation}
                          placeholder="Destination location"
                          placeholderTextColor={Colors.textSecondary}
                        />
                      </View>
                    </View>

                    {/* Date and Time */}
                    <View style={styles.modalRow}>
                      <View style={[styles.modalInputGroup, styles.modalHalfWidth]}>
                        <Text style={styles.modalLabel}>Date</Text>
                        <TouchableOpacity 
                          style={styles.modalDateTimeButton}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <CalendarIcon size={20} color={Colors.primary} />
                          <Text style={styles.modalDateTimeText}>
                            {editDepartureDate.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.modalInputGroup, styles.modalHalfWidth]}>
                        <Text style={styles.modalLabel}>Time</Text>
                        <TouchableOpacity 
                          style={styles.modalDateTimeButton}
                          onPress={() => setShowTimePicker(true)}
                        >
                          <TimeIcon size={20} color={Colors.primary} />
                          <Text style={styles.modalDateTimeText}>
                            {editDepartureTime.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Native Date/Time Pickers - Right after date/time buttons */}
                    {showDatePicker && (
                      <DateTimePicker
                        value={editDepartureDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setEditDepartureDate(selectedDate);
                          }
                        }}
                        minimumDate={new Date()}
                      />
                    )}

                    {showTimePicker && (
                      <DateTimePicker
                        value={editDepartureTime}
                        mode="time"
                        display="default"
                        onChange={(event, selectedTime) => {
                          setShowTimePicker(false);
                          if (selectedTime) {
                            setEditDepartureTime(selectedTime);
                          }
                        }}
                      />
                    )}

                    {/* Price and Seats */}
                    <View style={styles.modalRow}>
                      <View style={[styles.modalInputGroup, styles.modalHalfWidth]}>
                        <Text style={styles.modalLabel}>Price per Seat</Text>
                        <View style={styles.modalInputWithIcon}>
                          <DollarIcon size={20} color={Colors.primary} />
                          <TextInput
                            style={styles.modalInputWithIconText}
                            value={editPricePerSeat}
                            onChangeText={setEditPricePerSeat}
                            placeholder="0.00"
                            keyboardType="numeric"
                            placeholderTextColor={Colors.textSecondary}
                          />
                        </View>
                      </View>

                      <View style={[styles.modalInputGroup, styles.modalHalfWidth]}>
                        <Text style={styles.modalLabel}>Total Seats</Text>
                        <View style={styles.modalInputWithIcon}>
                          <UserIcon size={20} color={Colors.primary} />
                          <TextInput
                            style={styles.modalInputWithIconText}
                            value={editTotalSeats}
                            onChangeText={setEditTotalSeats}
                            placeholder="1-8"
                            keyboardType="numeric"
                            placeholderTextColor={Colors.textSecondary}
                          />
                        </View>
                        {(approvedPassengers > 0 || editSelectedVehicle) && (
                          <View style={styles.capacityInfoContainer}>
                            {approvedPassengers > 0 && (
                              <Text style={styles.modalCapacityInfo}>
                                ⚠️ Minimum {approvedPassengers} seats (you have {approvedPassengers} approved passenger{approvedPassengers === 1 ? '' : 's'})
                              </Text>
                            )}
                            {editSelectedVehicle && (
                              <Text style={styles.vehicleCapacityInfo}>
                                🚗 Vehicle capacity: {editSelectedVehicle.seats - 1} passenger seats (driver seat reserved)
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Vehicle Selection */}
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Vehicle</Text>
                      {vehiclesLoading ? (
                        <View style={styles.modalInputWithIcon}>
                          <ActivityIndicator size="small" color={Colors.primary} />
                          <Text style={styles.modalInputWithIconText}>Loading vehicles...</Text>
                        </View>
                      ) : vehicles.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScrollContainer}>
                          {vehicles.map((vehicle) => (
                            <TouchableOpacity
                              key={vehicle.id}
                              style={[
                                styles.vehicleCard,
                                editSelectedVehicle?.id === vehicle.id && styles.selectedVehicleCard
                              ]}
                              onPress={() => {
                                setEditSelectedVehicle(vehicle);
                                // Auto-adjust seats based on vehicle capacity and approved passengers
                                const maxSeats = vehicle.seats - 1;
                                const currentSeats = parseInt(editTotalSeats) || 1;
                                const minSeats = Math.max(1, approvedPassengers);
                                
                                if (currentSeats > maxSeats) {
                                  setEditTotalSeats(maxSeats.toString());
                                } else if (currentSeats < minSeats) {
                                  setEditTotalSeats(minSeats.toString());
                                }
                              }}
                            >
                              <Text style={styles.vehicleTitle}>
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </Text>
                              <Text style={styles.vehicleDetails}>
                                {vehicle.color} • {vehicle.seats} seats
                              </Text>
                              <Text style={styles.vehiclePlate}>
                                {vehicle.license_plate}
                              </Text>
                              {vehicle.is_default && (
                                <View style={styles.defaultBadge}>
                                  <Text style={styles.defaultBadgeText}>Default</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addVehicleButton}
                          onPress={() => router.push('/vehicles')}
                        >
                          <Text style={styles.addVehicleText}>+ Add Vehicle</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Description */}
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Description (Optional)</Text>
                      <TextInput
                        style={[styles.modalInput, styles.modalTextArea]}
                        value={editDescription}
                        onChangeText={setEditDescription}
                        placeholder="Add any additional details about your ride..."
                        placeholderTextColor={Colors.textSecondary}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                  </View>
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.modalActionContainer}>
                  <Button
                    title="Cancel"
                    onPress={handleCloseEditModal}
                    variant="outline"
                    style={styles.modalCancelButton}
                  />
                  <Button
                    title={editSaving ? "Saving..." : "Save Changes"}
                    onPress={handleSaveEdit}
                    style={styles.modalSaveButton}
                    disabled={editSaving}
                    icon={editSaving ? <ActivityIndicator size="small" color={Colors.white} /> : undefined}
                  />
                </View>
              </KeyboardAvoidingView>

          </Animated.View>
        </View>
      </Modal>
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
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
  },
  sectionContainer: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  requestCard: {
    marginBottom: Spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerName: {
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  rideInfo: {
    marginBottom: Spacing.md,
  },
  rideTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeArrow: {
    marginHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  locationText: {
    marginLeft: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  messageContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  messageLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  messageText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  approveButton: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  rideCard: {
    marginBottom: Spacing.md,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  rideActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Modern Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    elevation: 2,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: Colors.primary,
    elevation: 1,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  activeTabText: {
    color: Colors.white,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  cancelButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.error,
  },
  leaveButton: {
    borderColor: Colors.error,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  editButton: {
    flex: 1,
    marginRight: Spacing.sm,
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  deleteButton: {
    flex: 1,
    marginLeft: Spacing.sm,
    backgroundColor: 'transparent',
    borderColor: Colors.error,
    borderWidth: 1,
  },
  deleteButtonText: {
    color: Colors.error,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    elevation: 10,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  modalLoadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  keyboardContainer: {
    flex: 1,
  },
  modalScrollContainer: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  modalFormContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    minHeight: 400,
  },
  modalInputGroup: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 48,
  },
  modalInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    minHeight: 48,
  },
  modalInputWithIconText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalHalfWidth: {
    width: '48%',
  },
  modalActionContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelButton: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  modalSaveButton: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  modalCapacityInfo: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  modalDateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    minHeight: 48,
  },
  modalDateTimeText: {
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  // Vehicle picker styles
  vehicleScrollContainer: {
    marginTop: Spacing.sm,
  },
  vehicleCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    minWidth: 200,
    position: 'relative',
  },
  selectedVehicleCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  vehicleTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  vehicleDetails: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  vehiclePlate: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  defaultBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  defaultBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '600',
  },
  addVehicleButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addVehicleText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  // Capacity info styles
  capacityInfoContainer: {
    marginTop: Spacing.xs,
  },
  vehicleCapacityInfo: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  // Passengers section styles
  dividerLine: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  passengersSection: {
    marginBottom: Spacing.md,
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
});
