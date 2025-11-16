import { useState, useEffect, useCallback } from 'react'
import { liveRideApi, Ride } from '../lib/supabase-live-rides'
import { useAuth } from '../contexts/AuthContext'

export const useLiveRides = () => {
  const { user } = useAuth()
  const [liveRides, setLiveRides] = useState<Ride[]>([])
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)

  // Check for live rides every 30 seconds
  const checkLiveRides = useCallback(async () => {
    if (!user?.id) return

    try {
      console.log('🔄 Checking for live rides...')
      
      // Get user's upcoming rides
      const upcoming = await liveRideApi.getUserUpcomingRides(user.id)
      setUpcomingRides(upcoming)

      console.log('🔍 Filtering for live rides...')
      // Filter rides that should be live (within 10 minutes, not expired)
      const live = upcoming.filter(ride => liveRideApi.isRideLive(ride))
      
      // Log any rides that are expiring soon
      upcoming.forEach(ride => {
        const status = liveRideApi.getRideTimeStatus(ride)
        if (status.status === 'live' && status.message.includes('expires in')) {
          console.log(`⏰ Ride "${ride.title}" ${status.message}`)
        }
      })
      
      setLiveRides(live)

      console.log(`📊 FINAL RESULT: Found ${upcoming.length} upcoming rides, ${live.length} are live`)
    } catch (error) {
      console.error('Error checking live rides:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Initial load and periodic checks
  useEffect(() => {
    if (user?.id) {
      checkLiveRides()

      // Check every 30 seconds for new live rides
      const interval = setInterval(checkLiveRides, 30000)

      return () => clearInterval(interval)
    }
  }, [user?.id, checkLiveRides])

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true)
    checkLiveRides()
  }, [checkLiveRides])

  return {
    liveRides,
    upcomingRides,
    loading,
    refresh,
    hasLiveRides: liveRides.length > 0,
  }
}
