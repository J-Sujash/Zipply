import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { liveRideApi } from '../lib/supabase-live-rides'
import { useAuth } from '../contexts/AuthContext'
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors'

export const LiveRideDebugger: React.FC = () => {
  const { user } = useAuth()
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const runDebug = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user logged in')
      return
    }

    setLoading(true)
    setDebugInfo('Starting debug...\n')

    try {
      // Test 1: Get upcoming rides
      console.log('=== LIVE RIDE DEBUG START ===')
      const upcoming = await liveRideApi.getUserUpcomingRides(user.id)
      
      let info = `=== LIVE RIDE DEBUG ===\n`
      info += `User ID: ${user.id}\n`
      info += `Current time: ${new Date().toISOString()}\n\n`
      
      info += `UPCOMING RIDES (${upcoming.length}):\n`
      upcoming.forEach((ride, index) => {
        const rideDateTime = new Date(`${ride.departure_date}T${ride.departure_time}`)
        const minutesUntilStart = (rideDateTime.getTime() - new Date().getTime()) / (1000 * 60)
        const isLive = liveRideApi.isRideLive(ride)
        const timeStatus = liveRideApi.getRideTimeStatus(ride)
        
        info += `\n${index + 1}. "${ride.title}"\n`
        info += `   Date: ${ride.departure_date}\n`
        info += `   Time: ${ride.departure_time}\n`
        info += `   DateTime: ${rideDateTime.toISOString()}\n`
        info += `   Minutes until start: ${Math.round(minutesUntilStart)}\n`
        info += `   Status: ${ride.status}\n`
        info += `   Started at: ${ride.started_at || 'Not started'}\n`
        info += `   Should be live: ${isLive}\n`
        info += `   Time status: ${timeStatus.message}\n`
        info += `   Driver ID: ${ride.driver_id}\n`
        info += `   User is driver: ${ride.driver_id === user.id}\n`
      })

      // Test 2: Check live rides
      const live = upcoming.filter(ride => liveRideApi.isRideLive(ride))
      info += `\nLIVE RIDES (${live.length}):\n`
      live.forEach((ride, index) => {
        info += `${index + 1}. "${ride.title}"\n`
      })

      setDebugInfo(info)
      console.log('=== LIVE RIDE DEBUG END ===')
      
    } catch (error) {
      const errorInfo = `ERROR: ${error}\n${debugInfo}`
      setDebugInfo(errorInfo)
      console.error('Debug error:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearDebug = () => {
    setDebugInfo('')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Ride Debugger</Text>
      
      <View style={styles.buttons}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={runDebug}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Debug...' : 'Run Debug'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearDebug}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {debugInfo ? (
        <ScrollView style={styles.debugOutput}>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </ScrollView>
      ) : (
        <Text style={styles.placeholder}>
          Press "Run Debug" to see detailed information about live rides
        </Text>
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 500,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: Colors.textSecondary,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  debugOutput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    maxHeight: 300,
  },
  debugText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  placeholder: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: Spacing.xl,
  },
})
