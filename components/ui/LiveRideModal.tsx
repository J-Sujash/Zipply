import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { LiveRide } from '../../lib/apiClient';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import {
  CarIcon,
  PhoneIcon,
  MessageIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  XIcon,
  CheckIcon,
  StarIcon,
  UserIcon,
} from './Icons';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_driver: boolean;
}

interface RideActivity {
  id: string;
  type: 'ride_started' | 'passenger_picked_up' | 'passenger_dropped_off' | 'ride_completed' | 'ride_delayed';
  message: string;
  timestamp: string;
  passenger_name?: string;
}

interface PassengerStatus {
  id: string;
  name: string;
  profile_picture?: string;
  status: 'waiting' | 'picked_up' | 'dropped_off';
  pickup_confirmed: boolean;
}

interface LiveRideModalProps {
  visible: boolean;
  liveRide: LiveRide | null;
  onClose: () => void;
  onCallDriver?: () => void;
  onMessageDriver?: () => void;
  onNavigate?: () => void;
  onConfirmPickup?: (passengerId: string) => void;
  onReportIssue?: (issue: string) => void;
  onSubmitRating?: (rating: number, feedback: string) => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;
const SNAP_THRESHOLD = 100;

export const LiveRideModal: React.FC<LiveRideModalProps> = ({
  visible,
  liveRide,
  onClose,
  onCallDriver,
  onMessageDriver,
  onNavigate,
  onConfirmPickup,
  onReportIssue,
  onSubmitRating,
}) => {
  const [modalHeight] = useState(new Animated.Value(MODAL_HEIGHT));
  const [opacity] = useState(new Animated.Value(0));
  const [dragY] = useState(new Animated.Value(0));
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Enhanced state for new features
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'activity'>('overview');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [rideActivities, setRideActivities] = useState<RideActivity[]>([]);
  const [passengerStatuses, setPassengerStatuses] = useState<PassengerStatus[]>([]);
  const [showPickupConfirm, setShowPickupConfirm] = useState<string | null>(null);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SNAP_THRESHOLD) {
          closeModal();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      openModal();
    } else {
      closeModal();
    }
  }, [visible]);

  const openModal = () => {
    setIsExpanded(false);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(modalHeight, {
        toValue: MODAL_HEIGHT * 0.6, // Start at 60% height
        useNativeDriver: false,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(modalHeight, {
        toValue: 0,
        useNativeDriver: false,
      }),
    ]).start(() => {
      onClose();
      dragY.setValue(0);
    });
  };

  const expandModal = () => {
    setIsExpanded(true);
    Animated.spring(modalHeight, {
      toValue: MODAL_HEIGHT,
      useNativeDriver: false,
    }).start();
  };

  const collapseModal = () => {
    setIsExpanded(false);
    Animated.spring(modalHeight, {
      toValue: MODAL_HEIGHT * 0.6,
      useNativeDriver: false,
    }).start();
  };

  const handleCall = () => {
    if (liveRide?.driver_phone) {
      Linking.openURL(`tel:${liveRide.driver_phone}`);
    } else {
      Alert.alert('Phone Not Available', 'Driver phone number is not available.');
    }
  };

  const handleMessage = () => {
    if (onMessageDriver) {
      onMessageDriver();
    }
  };

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return '#6B7280'; // Gray
      case 'driver_en_route':
        return '#3B82F6'; // Blue
      case 'live':
      case 'in_progress':
        return '#10B981'; // Green
      case 'completed':
        return '#059669'; // Dark Green
      default:
        return Colors.primary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
      case 'driver_en_route':
        return 'Driver En Route';
      case 'live':
        return 'In Progress';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return 'Active';
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && liveRide) {
      const message: ChatMessage = {
        id: Date.now().toString(),
        sender_id: 'current_user_id', // Replace with actual user ID
        sender_name: 'You',
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        is_driver: liveRide.user_role === 'driver',
      };
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  const handleConfirmPickup = (passengerId: string) => {
    if (onConfirmPickup) {
      onConfirmPickup(passengerId);
    }
    setShowPickupConfirm(null);
    // Update passenger status locally
    setPassengerStatuses(prev => 
      prev.map(p => p.id === passengerId ? { ...p, status: 'picked_up', pickup_confirmed: true } : p)
    );
  };

  const handleReportIssueSubmit = () => {
    if (onReportIssue && issueDescription.trim()) {
      onReportIssue(issueDescription.trim());
      setIssueDescription('');
      setShowReportIssue(false);
      Alert.alert('Issue Reported', 'Your issue has been submitted successfully.');
    }
  };

  const handleRatingSubmit = () => {
    if (onSubmitRating && rating > 0) {
      onSubmitRating(rating, ratingFeedback);
      setShowRating(false);
      Alert.alert('Rating Submitted', 'Thank you for your feedback!');
    }
  };

  const renderStarRating = (currentRating: number, onPress?: (star: number) => void) => {
    return (
      <View style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress?.(star)}
            style={styles.starButton}
          >
            <StarIcon
              size={24}
              color={star <= currentRating ? '#F59E0B' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (!liveRide) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeModal}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              height: modalHeight,
              transform: [{ translateY: dragY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Ride Overview Card */}
          <View style={styles.rideOverviewCard}>
            <View style={styles.overviewHeader}>
              <View style={styles.driverSection}>
                <View style={styles.driverAvatar}>
                  {liveRide.driver_profile_picture ? (
                    <Image 
                      source={{ uri: liveRide.driver_profile_picture }} 
                      style={styles.driverAvatarImage}
                    />
                  ) : (
                    <UserIcon size={24} color={Colors.white} />
                  )}
                </View>
                <View style={styles.driverInfo}>
                  <View style={styles.driverNameRow}>
                    <Text style={styles.driverName}>{liveRide.driver_name}</Text>
                    <View style={styles.verifiedBadge}>
                      <CheckIcon size={12} color={Colors.white} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </View>
                  {liveRide.vehicle && (
                    <Text style={styles.vehicleInfo}>
                      {liveRide.vehicle.year} {liveRide.vehicle.make} {liveRide.vehicle.model}
                    </Text>
                  )}
                  {liveRide.status === 'live' && liveRide.vehicle?.license_plate && (
                    <Text style={styles.licensePlate}>
                      License: {liveRide.vehicle.license_plate}
                    </Text>
                  )}
                </View>
              </View>
              
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <XIcon size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rideMetaRow}>
              <View style={styles.passengerCount}>
                <UsersIcon size={16} color={Colors.textSecondary} />
                <Text style={styles.passengerCountText}>
                  {liveRide.passengers.length} passengers
                </Text>
              </View>
              <Text style={styles.rideId}>ID: {liveRide.id.slice(-6)}</Text>
            </View>
          </View>

          {/* Dynamic Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: getStatusColor(liveRide.status) + '20' }]}>
            <View style={styles.statusContent}>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(liveRide.status) }]} />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusTitle, { color: getStatusColor(liveRide.status) }]}>
                  {getStatusText(liveRide.status)}
                </Text>
                <Text style={styles.statusTimestamp}>
                  {liveRide.started_at ? `Started ${formatTime(liveRide.started_at)}` : 
                   `Scheduled for ${formatTime(liveRide.departure_time)}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            {['overview', 'chat', 'activity'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Driver Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Driver Information</Text>
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                  {liveRide.driver_profile_picture ? (
                    <Image 
                      source={{ uri: liveRide.driver_profile_picture }} 
                      style={styles.driverAvatarImage}
                    />
                  ) : (
                    <Text style={styles.driverInitials}>
                      {liveRide.driver_name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  )}
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{liveRide.driver_name}</Text>
                  <Text style={styles.driverRole}>
                    {liveRide.user_role === 'driver' ? 'You are driving' : 'Your driver'}
                  </Text>
                </View>
                
                {liveRide.user_role === 'passenger' && (
                  <View style={styles.driverActions}>
                    <TouchableOpacity onPress={handleCall} style={styles.actionButton}>
                      <PhoneIcon size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleMessage} style={styles.actionButton}>
                      <MessageIcon size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Vehicle Info */}
            {liveRide.vehicle && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vehicle Details</Text>
                <View style={styles.vehicleCard}>
                  <View style={styles.vehicleIcon}>
                    <CarIcon size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleModel}>
                      {liveRide.vehicle.year} {liveRide.vehicle.make} {liveRide.vehicle.model}
                    </Text>
                    <Text style={styles.vehicleDetails}>
                      {liveRide.vehicle.color} • {liveRide.vehicle.license_plate}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Route Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Route</Text>
              <View style={styles.routeCard}>
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, styles.routeDotStart]} />
                  <Text style={styles.routeLocation}>{liveRide.departure_location}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, styles.routeDotEnd]} />
                  <Text style={styles.routeLocation}>{liveRide.destination_location}</Text>
                </View>
              </View>
            </View>

            {/* Passengers */}
            {liveRide.passengers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Passengers ({liveRide.passengers.length})
                </Text>
                {liveRide.passengers.map((passenger, index) => (
                  <View key={index} style={styles.passengerCard}>
                    <View style={styles.passengerAvatar}>
                      {passenger.passenger.profile_picture_url ? (
                        <Image 
                          source={{ uri: passenger.passenger.profile_picture_url }} 
                          style={styles.passengerAvatarImage}
                        />
                      ) : (
                        <Text style={styles.passengerInitials}>
                          {passenger.passenger.first_name[0]}{passenger.passenger.last_name[0]}
                        </Text>
                      )}
                    </View>
                    <View style={styles.passengerInfo}>
                      <Text style={styles.passengerName}>
                        {passenger.passenger.first_name} {passenger.passenger.last_name}
                      </Text>
                      <Text style={styles.passengerSeats}>
                        {passenger.seats_requested} seat{passenger.seats_requested > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Expand/Collapse Button */}
            <TouchableOpacity 
              onPress={isExpanded ? collapseModal : expandModal}
              style={styles.expandButton}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Show Less' : 'Show More Details'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity onPress={handleNavigate} style={styles.primaryAction}>
              <MapPinIcon size={20} color={Colors.white} />
              <Text style={styles.primaryActionText}>Navigate</Text>
            </TouchableOpacity>
            
            {liveRide.user_role === 'passenger' && (
              <TouchableOpacity onPress={handleMessage} style={styles.secondaryAction}>
                <MessageIcon size={20} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>Message</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.primary,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  closeButton: {
    padding: Spacing.xs,
  },
  rideTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  rideSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  driverAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  driverInitials: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  driverRole: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  driverActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    elevation: 2,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleModel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  vehicleDetails: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  routeCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  routeDotStart: {
    backgroundColor: Colors.primary,
  },
  routeDotEnd: {
    backgroundColor: Colors.success,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: Colors.border,
    marginLeft: 5,
    marginVertical: Spacing.xs,
  },
  routeLocation: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  passengerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  passengerInitials: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  passengerSeats: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  expandButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
  },
  expandButtonText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  primaryAction: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  primaryActionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  // New Modern Live Ride Styles
  rideOverviewCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  driverSection: {
    flexDirection: 'row',
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: Spacing.xs,
  },
  verifiedText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: 2,
  },
  licensePlate: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  rideMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerCountText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  rideId: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  statusBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusTimestamp: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  activeTab: {
    backgroundColor: Colors.white,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
});
