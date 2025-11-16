import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { liveRideApi } from '../lib/supabase-live-rides'
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors'

export const LiveRideDemo: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const createTestRide = async () => {
    setLoading(true)
    
    try {
      // This would normally be done through your existing ride creation flow
      // For demo purposes, we're showing how to check if a ride should be live
      
      const now = new Date()
      const testRide = {
        id: 'test-ride-id',
        driver_id: 'test-driver-id',
        title: 'Test Campus Ride',
        description: 'Demo ride for testing live functionality',
        departure_location: 'University Campus',
        destination_location: 'Downtown Mall',
        departure_date: now.toISOString().split('T')[0], // Today
        departure_time: new Date(now.getTime() + 5 * 60000).toTimeString().split(' ')[0], // 5 minutes from now
        status: 'active' as const,
        total_seats: 4,
        available_seats: 3,
        price_per_seat: 5.00,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }

      // Check if this ride should be live
      const shouldBeLive = liveRideApi.isRideLive(testRide)
      
      const timeStatus = liveRideApi.getRideTimeStatus(testRide)
      
      Alert.alert(
        'Test Ride Created',
        `Departure: ${testRide.departure_time}\nStatus: ${timeStatus.message}\n\nTiming Rules:\n• Live 10 minutes before departure\n• Auto-expires 30 minutes after start time\n• Unless driver manually starts the ride`,
        [{ text: 'OK' }]
      )
    } catch (error) {
      Alert.alert('Error', 'Failed to create test ride')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Ride System Demo</Text>
      <Text style={styles.description}>
        This demonstrates the live ride system that automatically activates rides 10 minutes before departure.
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={createTestRide}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Test Ride (5 min from now)'}
        </Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          • Rides automatically become "live" 10 minutes before departure{'\n'}
          • Auto-expire 30 minutes after start time (if driver doesn't start){'\n'}
          • Driver can manually start ride to keep it live longer{'\n'}
          • Real-time updates between driver and passengers{'\n'}
          • Uses Supabase Realtime for instant updates
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    margin: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  infoBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  infoTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
})
