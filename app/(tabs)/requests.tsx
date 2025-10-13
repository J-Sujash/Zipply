import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  LocationIcon,
  TimeIcon,
  CalendarIcon,
  UserIcon,
  CheckIcon,
  XIcon,
  CarIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
  MessageIcon,
} from '../../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Ride } from '../../lib/supabase';
import { deleteRide } from '../../lib/rideManagement';
import { NotificationIcon } from '../../components/ui/NotificationIcon';
import { EditRideModal } from '../../components/modals/EditRideModal';
import { getOrCreateConversation } from '../../lib/messaging';

interface RideRequest {
  id: string;
  type: 'incoming' | 'outgoing';
  rideId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  requesterName?: string;
  driverName?: string;
  message?: string;
}

interface OfferedRide {
  id: string;
  title: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  status: 'active' | 'completed' | 'cancelled';
  requestsCount: number;
  passengers: Array<{
    id: string;
    name: string;
    seatsRequested: number;
  }>;
}


export default function RequestsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [selectedTab, setSelectedTab] = useState<'incoming' | 'outgoing' | 'offered'>('incoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<RideRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<RideRequest[]>([]);
  const [offeredRides, setOfferedRides] = useState<OfferedRide[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRideForEdit, setSelectedRideForEdit] = useState<Ride | null>(null);

  // Handle navigation from notifications
  useEffect(() => {
    if (params.tab && typeof params.tab === 'string') {
      const validTabs = ['incoming', 'outgoing', 'offered'] as const;
      if (validTabs.includes(params.tab as any)) {
        setSelectedTab(params.tab as 'incoming' | 'outgoing' | 'offered');
      }
    }
  }, [params.tab]);

  const tabs = [
    { id: 'incoming', label: 'Incoming' },
    { id: 'outgoing', label: 'My Requests' },
    { id: 'offered', label: 'My Offered' },
  ];

  const filteredRequests = selectedTab === 'incoming' ? incomingRequests : outgoingRequests;
  const currentOfferedRides = selectedTab === 'offered' ? offeredRides : [];

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedTab]);

  const fetchData = async () => {
    if (!user) {
      console.log('No user found, skipping data fetch');
      return;
    }
    
    console.log('Fetching data for tab:', selectedTab, 'user:', user.id);
    
    try {
      setLoading(true);
      
      if (selectedTab === 'incoming') {
        console.log('Fetching incoming requests...');
        await fetchIncomingRequests();
      } else if (selectedTab === 'outgoing') {
        console.log('Fetching outgoing requests...');
        await fetchOutgoingRequests();
      } else if (selectedTab === 'offered') {
        console.log('Fetching offered rides...');
        await fetchOfferedRides();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchIncomingRequests = async () => {
    if (!user) return;

    // First get rides where user is the driver
    const { data: userRides, error: ridesError } = await supabase
      .from('rides')
      .select('id')
      .eq('driver_id', user.id);

    if (ridesError) throw ridesError;

    if (!userRides || userRides.length === 0) {
      setIncomingRequests([]);
      return;
    }

    const rideIds = userRides.map(ride => ride.id);

    // Then get requests for those rides
    const { data, error } = await supabase
      .from('ride_requests')
      .select(`
        id,
        seats_requested,
        message,
        status,
        created_at,
        ride_id,
        ride:rides!ride_requests_ride_id_fkey (
          id,
          title,
          departure_location,
          destination_location,
          departure_date,
          departure_time,
          price_per_seat
        ),
        passenger:profiles!ride_requests_passenger_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .in('ride_id', rideIds)
      .eq('status', 'pending');

    if (error) throw error;

    const formattedRequests: RideRequest[] = (data || []).map((request: any) => ({
      id: request.id,
      type: 'incoming' as const,
      rideId: request.ride.id,
      from: request.ride.departure_location,
      to: request.ride.destination_location,
      date: formatDate(request.ride.departure_date),
      time: formatTime(request.ride.departure_time),
      price: request.ride.price_per_seat,
      status: request.status,
      requesterName: `${request.passenger.first_name} ${request.passenger.last_name}`,
      message: request.message,
    }));

    setIncomingRequests(formattedRequests);
  };

  const fetchOutgoingRequests = async () => {
    if (!user) return;

    console.log('Fetching outgoing requests for user:', user.id);

    const { data, error } = await supabase
      .from('ride_requests')
      .select(`
        id,
        seats_requested,
        message,
        status,
        created_at,
        ride_id,
        ride:rides!ride_requests_ride_id_fkey (
          id,
          title,
          departure_location,
          destination_location,
          departure_date,
          departure_time,
          price_per_seat,
          driver:profiles!rides_driver_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .eq('passenger_id', user.id);

    if (error) {
      console.error('Error fetching outgoing requests:', error);
      throw error;
    }

    console.log('Outgoing requests data:', data);

    const formattedRequests: RideRequest[] = (data || []).map((request: any) => ({
      id: request.id,
      type: 'outgoing' as const,
      rideId: request.ride.id,
      from: request.ride.departure_location,
      to: request.ride.destination_location,
      date: formatDate(request.ride.departure_date),
      time: formatTime(request.ride.departure_time),
      price: request.ride.price_per_seat,
      status: request.status,
      driverName: `${request.ride.driver.first_name} ${request.ride.driver.last_name}`,
      message: request.message,
    }));

    console.log('Formatted outgoing requests:', formattedRequests);
    setOutgoingRequests(formattedRequests);
  };

  const fetchOfferedRides = async () => {
    if (!user) return;

    // Fetch rides created by the user
    const { data: ridesData, error: ridesError } = await supabase
      .from('rides')
      .select(`
        id,
        title,
        departure_location,
        destination_location,
        departure_date,
        departure_time,
        price_per_seat,
        total_seats,
        available_seats,
        status
      `)
      .eq('driver_id', user.id);

    if (ridesError) throw ridesError;

    // For each ride, count pending requests and get approved passengers
    const ridesWithCounts = await Promise.all(
      (ridesData || []).map(async (ride: any) => {
        // Count pending requests
        const { count } = await supabase
          .from('ride_requests')
          .select('*', { count: 'exact', head: true })
          .eq('ride_id', ride.id)
          .eq('status', 'pending');

        // Get approved passengers
        const { data: approvedRequests, error: passengersError } = await supabase
          .from('ride_requests')
          .select(`
            id,
            seats_requested,
            passenger:profiles!ride_requests_passenger_id_fkey (
              id,
              first_name,
              last_name
            )
          `)
          .eq('ride_id', ride.id)
          .eq('status', 'approved');

        if (passengersError) {
          console.error('Error fetching passengers:', passengersError);
        }

        const passengers = (approvedRequests || []).map((request: any) => ({
          id: request.passenger.id,
          name: `${request.passenger.first_name} ${request.passenger.last_name}`,
          seatsRequested: request.seats_requested || 1,
        }));

        return {
          id: ride.id,
          title: ride.title,
          from: ride.departure_location,
          to: ride.destination_location,
          date: formatDate(ride.departure_date),
          time: formatTime(ride.departure_time),
          price: ride.price_per_seat,
          totalSeats: ride.total_seats,
          availableSeats: ride.available_seats,
          status: ride.status,
          requestsCount: count || 0,
          passengers,
        };
      })
    );

    setOfferedRides(ridesWithCounts);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApproveRequest = async (requestId: string) => {
    Alert.alert(
      'Approve Request',
      'Are you sure you want to approve this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve', 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ride_requests')
                .update({ status: 'approved' })
                .eq('id', requestId);

              if (error) throw error;

              Alert.alert('Success', 'Request approved successfully!');
              fetchData(); // Refresh data
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve request');
            }
          }
        },
      ]
    );
  };

  const handleRejectRequest = (requestId: string) => {
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
              const { error } = await supabase
                .from('ride_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);

              if (error) throw error;

              Alert.alert('Request Rejected', 'The request has been rejected.');
              fetchData(); // Refresh data
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject request');
            }
          }
        },
      ]
    );
  };

  const handleEditRide = async (rideId: string) => {
    try {
      // Fetch the full ride data for editing
      const { data: rideData, error } = await supabase
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
        .eq('id', rideId)
        .single();

      if (error) throw error;
      if (!rideData) throw new Error('Ride not found');

      setSelectedRideForEdit(rideData);
      setEditModalVisible(true);
    } catch (error: any) {
      console.error('Error fetching ride for edit:', error);
      Alert.alert('Error', error.message || 'Failed to load ride details');
    }
  };

  const handleDeleteRide = async (rideId: string) => {
    try {
      // Get ride details for confirmation dialog
      const { data: rideData, error: fetchError } = await supabase
        .from('rides')
        .select('departure_location, destination_location')
        .eq('id', rideId)
        .single();

      if (fetchError) throw fetchError;

      Alert.alert(
        'Delete Ride',
        `Are you sure you want to delete your ride from ${rideData.departure_location} to ${rideData.destination_location}?\n\nThis action cannot be undone and will notify any passengers.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteRide(rideId);
                Alert.alert(
                  'Ride Deleted',
                  'Your ride has been successfully deleted.',
                  [{ text: 'OK', onPress: () => fetchData() }]
                );
              } catch (error: any) {
                console.error('Error deleting ride:', error);
                Alert.alert(
                  'Error',
                  error.message || 'Failed to delete ride. Please try again.'
                );
              }
            }
          },
        ]
      );
    } catch (error: any) {
      console.error('Error preparing delete:', error);
      Alert.alert('Error', 'Failed to load ride details');
    }
  };

  const handleViewRideRequests = (rideId: string) => {
    // TODO: Navigate to ride requests screen
    Alert.alert('View Requests', `Viewing requests for ride ${rideId}`);
  };

  // Add debouncing to prevent multiple rapid navigations
  const [isNavigating, setIsNavigating] = useState(false);

  const handleViewRideDetails = async (rideId: string) => {
    if (isNavigating) {
      console.log('⚠️ Navigation already in progress, ignoring duplicate request');
      return;
    }

    try {
      setIsNavigating(true);
      console.log('Navigating to ride details:', rideId);
      router.push({ pathname: '/ride/[rideId]', params: { rideId } });
      
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 1000);
    } catch (error) {
      console.error('Navigation error:', error);
      setIsNavigating(false);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    console.log('🔥 CANCEL REQUEST CLICKED - Request ID:', requestId);
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
              console.log('🗑️ Starting deletion process for request ID:', requestId);
              console.log('🔍 Request ID type:', typeof requestId);
              console.log('🔍 Request ID value:', JSON.stringify(requestId));
              
              // First, verify the request exists
              const { data: existingRequest, error: checkError } = await supabase
                .from('ride_requests')
                .select('id, status, passenger_id')
                .eq('id', requestId)
                .single();

              console.log('🔍 Existing request check:', { existingRequest, checkError });

              if (checkError) {
                console.error('❌ Error checking request existence:', checkError);
                throw new Error(`Request not found: ${checkError.message}`);
              }

              if (!existingRequest) {
                throw new Error('Request does not exist');
              }

              console.log('✅ Request found, proceeding with deletion...');
              
              // Get the ride_id and seats_requested before deletion
              const { data: requestData, error: requestError } = await supabase
                .from('ride_requests')
                .select('ride_id, seats_requested')
                .eq('id', requestId)
                .single();

              if (requestError) {
                console.error('❌ Error getting request data:', requestError);
                throw requestError;
              }

              // Delete the request from the database
              const { data: deleteData, error: deleteError } = await supabase
                .from('ride_requests')
                .delete()
                .eq('id', requestId);

              console.log('🗑️ Delete operation result:', { deleteData, deleteError });

              if (deleteError) {
                console.error('❌ Delete error:', deleteError);
                throw deleteError;
              }

              // Increment available seats using the database function
              if (requestData) {
                console.log('🔄 Incrementing available seats...');
                const { error: incrementError } = await supabase
                  .rpc('increment_available_seats', {
                    ride_id: requestData.ride_id,
                    seats_to_add: requestData.seats_requested || 1
                  });

                if (incrementError) {
                  console.error('❌ Error incrementing seats:', incrementError);
                  // Don't throw here - the request was already deleted successfully
                  Alert.alert('Warning', 'Request cancelled but seat count may not be updated correctly');
                } else {
                  console.log('✅ Available seats incremented successfully');
                }
              }

              console.log('✅ Request deleted successfully from database');
              Alert.alert('Success', 'Request cancelled successfully!');
              
              console.log('🔄 Refreshing data...');
              await fetchData(); // Refresh data
              console.log('✅ Data refresh completed');
              
            } catch (error: any) {
              console.error('💥 Cancel request error:', error);
              console.error('💥 Error details:', JSON.stringify(error, null, 2));
              Alert.alert('Error', error.message || 'Failed to cancel request');
            }
          }
        },
      ]
    );
  };

  const handleMessageDriver = async (rideId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to message the driver.');
      return;
    }

    try {
      // Get ride details to find the driver
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('id, driver_id')
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      if (!rideData) throw new Error('Ride not found');

      // Create or get existing conversation
      const conversationId = await getOrCreateConversation(
        rideId,
        rideData.driver_id, // driver
        user.id // passenger
      );

      // Navigate to the chat
      router.push(`/messages/${conversationId}`);
    } catch (error: any) {
      console.error('Error starting conversation with driver:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'approved':
        return Colors.success;
      case 'rejected':
        return Colors.error;
      case 'active':
        return Colors.success;
      case 'completed':
        return Colors.textSecondary;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const renderRequestCard = ({ item }: { item: RideRequest }) => (
    <Card variant="outlined" style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <UserIcon size={20} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.userName}>
              {item.type === 'incoming' ? item.requesterName : item.driverName}
            </Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.price}>${item.price}</Text>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <LocationIcon size={16} color={Colors.primary} />
          <Text style={styles.locationText}>{item.from}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <LocationIcon size={16} color={Colors.accent} />
          <Text style={styles.locationText}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <CalendarIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
        <View style={styles.detailItem}>
          <TimeIcon size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
      </View>

      {item.message && (
        <View style={styles.messageSection}>
          <Text style={styles.messageTitle}>Message:</Text>
          <Text style={styles.messageText}>{item.message}</Text>
        </View>
      )}

      {item.type === 'incoming' && item.status === 'pending' && (
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
            title="Approve"
            onPress={() => handleApproveRequest(item.id)}
            size="sm"
            style={styles.actionButton}
            icon={<CheckIcon size={16} color={Colors.white} />}
          />
        </View>
      )}

      {item.type === 'outgoing' && (
        <View style={styles.outgoingActions}>
          <Button
            title="View Ride Details"
            onPress={() => handleViewRideDetails(item.rideId)}
            variant="outline"
            size="sm"
            style={styles.actionButton}
          />
          {item.status === 'approved' && (
            <Button
              title="Message Driver"
              onPress={() => handleMessageDriver(item.rideId)}
              variant="outline"
              size="sm"
              style={styles.messageDriverButton}
              icon={<MessageIcon size={16} color={Colors.primary} />}
            />
          )}
          {item.status === 'pending' && (
            <Button
              title="Cancel Request"
              onPress={() => {
                console.log('🔘 Cancel button clicked for item:', item);
                console.log('🔘 Item ID being passed:', item.id);
                handleCancelRequest(item.id);
              }}
              variant="ghost"
              size="sm"
              style={styles.actionButton}
            />
          )}
        </View>
      )}
    </Card>
  );

  const renderOfferedRideCard = ({ item }: { item: OfferedRide }) => (
    <TouchableOpacity 
      onPress={() => handleViewRideDetails(item.id)}
      activeOpacity={0.7}
    >
      <Card variant="outlined" style={styles.offeredRideCard}>
      <View style={styles.offeredRideHeader}>
        <View style={styles.rideHeaderLeft}>
          <View style={styles.rideIconContainer}>
            <CarIcon size={18} color={Colors.white} />
          </View>
          <View style={styles.rideHeaderInfo}>
            <Text style={styles.rideTitle}>{item.title}</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.ridePrice}>${item.price}</Text>
      </View>

      <View style={styles.compactRouteInfo}>
        <View style={styles.locationRow}>
          <LocationIcon size={14} color={Colors.primary} />
          <Text style={styles.compactLocationText}>{item.from}</Text>
        </View>
        <View style={styles.compactRouteLine} />
        <View style={styles.locationRow}>
          <LocationIcon size={14} color={Colors.accent} />
          <Text style={styles.compactLocationText}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.compactRideDetails}>
        <View style={styles.detailItem}>
          <CalendarIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.compactDetailText}>{item.date}</Text>
        </View>
        <View style={styles.detailItem}>
          <TimeIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.compactDetailText}>{item.time}</Text>
        </View>
        <View style={styles.detailItem}>
          <UsersIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.compactDetailText}>{item.availableSeats}/{item.totalSeats - 1} seats</Text>
        </View>
      </View>

      {item.requestsCount > 0 && (
        <View style={styles.requestsIndicator}>
          <View style={styles.requestsBadge}>
            <Text style={styles.requestsCount}>{item.requestsCount}</Text>
          </View>
          <Text style={styles.requestsText}>
            {item.requestsCount === 1 ? '1 pending request' : `${item.requestsCount} pending requests`}
          </Text>
        </View>
      )}

      {item.passengers.length > 0 && (
        <View style={styles.passengersSection}>
          <Text style={styles.passengersTitle}>Passengers:</Text>
          <View style={styles.passengersList}>
            {item.passengers.map((passenger, index) => (
              <View key={passenger.id} style={styles.passengerChip}>
                <UserIcon size={12} color={Colors.primary} />
                <Text style={styles.passengerName}>{passenger.name}</Text>
                {passenger.seatsRequested > 1 && (
                  <Text style={styles.seatCount}>({passenger.seatsRequested})</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.offeredRideActions}>
        {item.requestsCount > 0 && (
          <Button
            title="View Requests"
            onPress={() => handleViewRideRequests(item.id)}
            variant="outline"
            size="sm"
            style={styles.actionButton}
            icon={<UserIcon size={16} color={Colors.primary} />}
          />
        )}
        {item.status === 'active' && (
          <>
            <Button
              title="Edit"
              onPress={() => handleEditRide(item.id)}
              variant="outline"
              size="sm"
              style={styles.editButton}
              icon={<EditIcon size={16} color={Colors.primary} />}
            />
            <Button
              title="Delete"
              onPress={() => handleDeleteRide(item.id)}
              variant="outline"
              size="sm"
              style={styles.deleteButton}
              icon={<TrashIcon size={16} color={Colors.error} />}
            />
          </>
        )}
      </View>
    </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>
        {selectedTab === 'incoming' ? '📥' : selectedTab === 'outgoing' ? '📤' : '🚗'}
      </Text>
      <Text style={styles.emptyStateTitle}>
        {selectedTab === 'incoming' 
          ? 'No Incoming Requests' 
          : selectedTab === 'outgoing' 
          ? 'No Outgoing Requests'
          : 'No Offered Rides'
        }
      </Text>
      <Text style={styles.emptyStateText}>
        {selectedTab === 'incoming' 
          ? 'Ride requests from other students will appear here.'
          : selectedTab === 'outgoing'
          ? 'Your ride requests to other drivers will appear here.'
          : 'Rides you\'ve created and offered to other students will appear here.'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Requests</Text>
            <Text style={styles.subtitle}>Manage ride requests</Text>
          </View>
          <NotificationIcon size={24} color={Colors.text} />
        </View>
      </View>

      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              selectedTab === tab.id && styles.tabActive,
            ]}
            onPress={() => setSelectedTab(tab.id as 'incoming' | 'outgoing' | 'offered')}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : selectedTab === 'offered' ? (
          currentOfferedRides.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={currentOfferedRides}
              renderItem={renderOfferedRideCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.requestsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )
        ) : (
          filteredRequests.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredRequests}
              renderItem={renderRequestCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.requestsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )
        )}
      </View>

      <EditRideModal
        visible={editModalVisible}
        ride={selectedRideForEdit}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedRideForEdit(null);
        }}
        onSuccess={(updatedRide) => {
          setEditModalVisible(false);
          setSelectedRideForEdit(null);
          fetchData(); // Refresh the data
        }}
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
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  requestsList: {
    paddingBottom: 100, // Extra space to prevent navbar overlap
  },
  requestCard: {
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  routeInfo: {
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 8,
    marginVertical: Spacing.xs,
  },
  rideDetails: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  messageSection: {
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  messageTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  messageText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  outgoingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  messageDriverButton: {
    flex: 1,
    borderColor: Colors.primary,
  },
  rejectButton: {
    flex: 1,
    borderColor: Colors.error,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Offered Ride Styles - Compact Design
  offeredRideCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  offeredRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  rideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rideIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rideHeaderInfo: {
    flex: 1,
  },
  rideTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  ridePrice: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.success,
  },
  requestsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '10',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.warning,
  },
  requestsBadge: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  requestsCount: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  requestsText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '600',
    flex: 1,
  },
  offeredRideActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  editButton: {
    flex: 1,
    minWidth: 70,
    borderColor: Colors.primary,
    paddingVertical: Spacing.xs,
  },
  deleteButton: {
    flex: 1,
    minWidth: 70,
    borderColor: Colors.error,
    paddingVertical: Spacing.xs,
  },
  // Compact styles for offered rides
  compactRouteInfo: {
    marginBottom: Spacing.sm,
  },
  compactLocationText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  compactRouteLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 7,
    marginVertical: 2,
  },
  compactRideDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  compactDetailText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  // Loading styles
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
  // Passengers section styles
  passengersSection: {
    marginBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  passengersTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  passengersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  passengerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  passengerName: {
    fontSize: FontSize.xs,
    color: Colors.text,
    marginLeft: 4,
    fontWeight: '500',
  },
  seatCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginLeft: 2,
    fontWeight: '400',
  },
});
