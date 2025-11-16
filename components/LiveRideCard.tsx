import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { RealtimeChannel } from '@supabase/supabase-js'
import {
  liveRideApi,
  LiveRideData,
  Ride,
  formatTime,
  formatDate,
  getStatusMessage,
} from '../lib/supabase-live-rides'
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors'
import {
  CarIcon,
  ClockIcon,
  UsersIcon,
  CheckIcon,
  XIcon,
  MapPinIcon,
} from './ui/Icons'

interface LiveRideCardProps {
  ride: Ride
  onClose?: () => void
}

export const LiveRideCard: React.FC<LiveRideCardProps> = ({ ride, onClose }) => {
  const [liveRideData, setLiveRideData] = useState<LiveRideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [timeStatus, setTimeStatus] = useState<any>(null)

  useEffect(() => {
    loadLiveRideData()
    setupRealtimeSubscription()
    updateTimeStatus()

    // Update time status every minute
    const timeInterval = setInterval(updateTimeStatus, 60000)

    return () => {
      if (channel) {
        liveRideApi.unsubscribeFromRide(channel)
      }
      clearInterval(timeInterval)
    }
  }, [ride.id])

  const updateTimeStatus = () => {
    const status = liveRideApi.getRideTimeStatus(ride)
    setTimeStatus(status)
    
    // If ride has expired, call onClose to remove it
    if (status.status === 'expired' && onClose) {
      setTimeout(() => onClose(), 2000) // Give user 2 seconds to see expiration message
    }
  }

  const loadLiveRideData = async () => {
    setLoading(true)
    
    try {
      // Use the correct API function from our new system
      const data = await liveRideApi.getRideWithPassengers(ride.id)
      setLiveRideData(data)
    } catch (error) {
      console.error('Error loading live ride data:', error)
      // If the server API fails, we can still show basic ride info
      setLiveRideData({
        ride,
        passengers: [],
        currentUser: { 
          id: ride.driver_id, 
          first_name: 'User', 
          last_name: '', 
          school_email: '', 
          rating: 0, 
          created_at: '' 
        },
        isDriver: true // We'll determine this properly later
      })
    }
    
    setLoading(false)
  }

  const setupRealtimeSubscription = () => {
    const newChannel = liveRideApi.subscribeToRide(ride.id, (payload) => {
      console.log('Live ride update:', payload)
      // Reload data when changes occur
      loadLiveRideData()
    })
    setChannel(newChannel)
  }

  const handleStartRide = async () => {
    if (!liveRideData?.isDriver) return

    Alert.alert(
      'Start Ride',
      'Are you ready to start the ride? Passengers will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Ride',
          onPress: async () => {
            const success = await liveRideApi.startLiveRide(ride.id)
            if (success) {
              Alert.alert('Success', 'Ride started! Passengers have been notified.')
            } else {
              Alert.alert('Error', 'Failed to start ride. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handleCompleteRide = async () => {
    if (!liveRideData?.isDriver) return

    Alert.alert(
      'Complete Ride',
      'Mark this ride as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            const success = await liveRideApi.completeLiveRide(ride.id)
            if (success) {
              Alert.alert('Success', 'Ride completed successfully!')
              onClose?.()
            } else {
              Alert.alert('Error', 'Failed to complete ride. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handlePassengerPickup = async (requestId: string, action: 'picked_up' | 'dropped_off') => {
    if (!liveRideData?.isDriver) return

    const success = await liveRideApi.updatePassengerPickupStatus(requestId, action)
    if (success) {
      Alert.alert('Success', `Passenger ${action.replace('_', ' ')} successfully!`)
    } else {
      Alert.alert('Error', 'Failed to update passenger status.')
    }
  }

  const getRideStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return Colors.success
      case 'completed':
        return Colors.primary
      default:
        return Colors.textSecondary
    }
  }

  const getPickupStatus = (pickupLocation?: string) => {
    if (pickupLocation === 'PICKED_UP') return 'picked_up'
    if (pickupLocation === 'DROPPED_OFF') return 'dropped_off'
    return 'waiting'
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading live ride...</Text>
      </View>
    )
  }

  if (!liveRideData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load ride data</Text>
      </View>
    )
  }

  const { ride: rideData, liveRide, passengers, isDriver } = liveRideData
  const isLive = !!liveRide && liveRide.status === 'active'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: getRideStatusColor(rideData.status) }]} />
          <Text style={styles.title}>{rideData.title}</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XIcon size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Message */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusMessage}>
          {getStatusMessage(isLive ? 'live' : rideData.status, isDriver)}
        </Text>
        <Text style={styles.timeText}>
          {formatDate(rideData.departure_date)} at {formatTime(rideData.departure_time)}
        </Text>
        {timeStatus && (
          <Text style={[styles.timingText, { 
            color: timeStatus.status === 'expired' ? Colors.error : 
                   timeStatus.status === 'live' ? Colors.warning : Colors.textSecondary 
          }]}>
            {timeStatus.message}
          </Text>
        )}
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.routeText}>{rideData.departure_location}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.routeText}>{rideData.destination_location}</Text>
        </View>
      </View>

      {/* Driver Actions */}
      {isDriver && (
        <View style={styles.actionsContainer}>
          {!isLive ? (
            <TouchableOpacity style={styles.startButton} onPress={handleStartRide}>
              <CarIcon size={20} color={Colors.white} />
              <Text style={styles.startButtonText}>Start Ride</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.completeButton} onPress={handleCompleteRide}>
              <CheckIcon size={20} color={Colors.white} />
              <Text style={styles.completeButtonText}>Complete Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Passengers List */}
      {passengers.length > 0 && (
        <View style={styles.passengersContainer}>
          <Text style={styles.sectionTitle}>
            Passengers ({passengers.length})
          </Text>
          <ScrollView style={styles.passengersList}>
            {passengers.map((passenger) => {
              const pickupStatus = getPickupStatus(passenger.pickup_location)
              return (
                <View key={passenger.id} style={styles.passengerCard}>
                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerName}>
                      {passenger.profile?.first_name} {passenger.profile?.last_name}
                    </Text>
                    <Text style={styles.passengerSeats}>
                      {passenger.seats_requested} seat{passenger.seats_requested > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.passengerStatus, { 
                      color: pickupStatus === 'waiting' ? Colors.warning : 
                             pickupStatus === 'picked_up' ? Colors.success : Colors.primary 
                    }]}>
                      {pickupStatus === 'waiting' ? 'Waiting' : 
                       pickupStatus === 'picked_up' ? 'Picked up' : 'Dropped off'}
                    </Text>
                  </View>

                  {/* Driver Controls */}
                  {isDriver && isLive && (
                    <View style={styles.passengerActions}>
                      {pickupStatus === 'waiting' && (
                        <TouchableOpacity
                          style={styles.pickupButton}
                          onPress={() => handlePassengerPickup(passenger.id, 'picked_up')}
                        >
                          <CheckIcon size={16} color={Colors.white} />
                          <Text style={styles.pickupButtonText}>Pick Up</Text>
                        </TouchableOpacity>
                      )}
                      {pickupStatus === 'picked_up' && (
                        <TouchableOpacity
                          style={styles.dropoffButton}
                          onPress={() => handlePassengerPickup(passenger.id, 'dropped_off')}
                        >
                          <MapPinIcon size={16} color={Colors.white} />
                          <Text style={styles.dropoffButtonText}>Drop Off</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Live Ride Info */}
      {liveRide && (
        <View style={styles.liveInfo}>
          <Text style={styles.liveInfoText}>
            Ride started at {formatTime(liveRide.started_at)}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    margin: Spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  statusContainer: {
    marginBottom: Spacing.lg,
  },
  statusMessage: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  timeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  timingText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  routeContainer: {
    marginBottom: Spacing.lg,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 3,
    marginVertical: Spacing.xs,
  },
  routeText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  actionsContainer: {
    marginBottom: Spacing.lg,
  },
  startButton: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  startButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  completeButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  completeButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  passengersContainer: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  passengersList: {
    maxHeight: 200,
  },
  passengerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  passengerSeats: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  passengerStatus: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  passengerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pickupButton: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  pickupButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.white,
  },
  dropoffButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  dropoffButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.white,
  },
  liveInfo: {
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  liveInfoText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    padding: Spacing.xl,
  },
})
