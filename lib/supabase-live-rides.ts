// Supabase client configuration for Live Ride system
import { createClient } from '@supabase/supabase-js'
import { RealtimeChannel } from '@supabase/supabase-js'

// Replace with your Supabase project credentials
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your-supabase-url'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for existing schema
export interface Ride {
  id: string
  driver_id: string
  title: string
  description?: string
  departure_location: string
  destination_location: string
  departure_date: string
  departure_time: string
  start_time?: string
  status: 'active' | 'completed' | 'cancelled'
  total_seats: number
  available_seats: number
  price_per_seat: number
  car_make?: string
  car_model?: string
  car_color?: string
  car_license_plate?: string
  created_at: string
  updated_at: string
  current_latitude?: number
  current_longitude?: number
  estimated_arrival?: string
  started_at?: string
  completed_at?: string
}

export interface LiveRide {
  id: string
  ride_id: string
  status: string
  current_latitude?: number
  current_longitude?: number
  estimated_arrival?: string
  started_at: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface RideRequest {
  id: string
  ride_id: string
  passenger_id: string
  seats_requested: number
  message?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  pickup_location?: string
  dropoff_location?: string
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Profile {
  id: string
  first_name: string
  last_name: string
  school_email: string
  phone_number?: string
  profile_picture_url?: string
  rating: number
  created_at: string
}

export interface LiveRideData {
  ride: Ride
  liveRide?: LiveRide
  passengers: RideRequest[]
  currentUser: Profile
  isDriver: boolean
}

// Live Ride API functions
export const liveRideApi = {
  // Get ride with passengers for live ride view
  async getRideWithPassengers(rideId: string): Promise<LiveRideData | null> {
    try {
      // Get ride details
      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single()

      if (rideError || !ride) {
        console.error('Error fetching ride:', rideError)
        return null
      }

      // Get live ride data if exists
      const { data: liveRide } = await supabase
        .from('live_rides')
        .select('*')
        .eq('ride_id', rideId)
        .single()

      // Get approved passengers with profiles
      const { data: passengers, error: passengersError } = await supabase
        .from('ride_requests')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('ride_id', rideId)
        .eq('status', 'approved')

      if (passengersError) {
        console.error('Error fetching passengers:', passengersError)
        return null
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: currentUser, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !currentUser) {
        console.error('Error fetching current user profile:', profileError)
        return null
      }

      const isDriver = ride.driver_id === user.id

      return {
        ride,
        liveRide: liveRide || undefined,
        passengers: passengers || [],
        currentUser,
        isDriver
      }
    } catch (error) {
      console.error('Error in getRideWithPassengers:', error)
      return null
    }
  },

  // Start live ride (creates live_rides entry and updates ride status)
  async startLiveRide(rideId: string): Promise<boolean> {
    try {
      // Create live ride entry
      const { error: liveRideError } = await supabase
        .from('live_rides')
        .insert({
          ride_id: rideId,
          status: 'active',
          started_at: new Date().toISOString()
        })

      if (liveRideError) {
        console.error('Error creating live ride:', liveRideError)
        return false
      }

      // Update ride status
      const { error: rideError } = await supabase
        .from('rides')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', rideId)

      if (rideError) {
        console.error('Error updating ride status:', rideError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in startLiveRide:', error)
      return false
    }
  },

  // Complete live ride
  async completeLiveRide(rideId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString()

      // Update live ride
      const { error: liveRideError } = await supabase
        .from('live_rides')
        .update({ 
          status: 'completed',
          completed_at: now
        })
        .eq('ride_id', rideId)

      if (liveRideError) {
        console.error('Error completing live ride:', liveRideError)
        return false
      }

      // Update ride status
      const { error: rideError } = await supabase
        .from('rides')
        .update({ 
          status: 'completed',
          completed_at: now
        })
        .eq('id', rideId)

      if (rideError) {
        console.error('Error updating ride status:', rideError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in completeLiveRide:', error)
      return false
    }
  },

  // Update passenger pickup status (using ride_requests table)
  async updatePassengerPickupStatus(
    requestId: string, 
    pickup_status: 'picked_up' | 'dropped_off'
  ): Promise<boolean> {
    try {
      // For now, we'll add a custom field to track pickup status
      // In a real app, you might want to add a pickup_status column to ride_requests
      const { error } = await supabase
        .from('ride_requests')
        .update({ 
          pickup_location: pickup_status === 'picked_up' ? 'PICKED_UP' : 'DROPPED_OFF'
        })
        .eq('id', requestId)

      if (error) {
        console.error('Error updating passenger status:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updatePassengerPickupStatus:', error)
      return false
    }
  },

  // Get user's upcoming rides (for checking activation)
  async getUserUpcomingRides(userId: string): Promise<Ride[]> {
    try {
      console.log('🔍 Getting upcoming rides for user:', userId)
      
      // First get ride IDs for the user as passenger
      const { data: userRides, error: userRidesError } = await supabase
        .from('ride_requests')
        .select('ride_id')
        .eq('passenger_id', userId)
        .eq('status', 'approved')

      if (userRidesError) {
        console.error('Error fetching user ride requests:', userRidesError)
      }

      const rideIds = userRides?.map(r => r.ride_id) || []
      console.log('📝 Found ride requests for user:', rideIds.length)
      
      // Also include rides where user is the driver
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('id')
        .eq('driver_id', userId)
        .eq('status', 'active')

      if (driverError) {
        console.error('Error fetching driver rides:', driverError)
      } else {
        rideIds.push(...(driverRides?.map(r => r.id) || []))
        console.log('🚗 Found driver rides for user:', driverRides?.length || 0)
      }

      console.log('🎯 Total ride IDs to check:', rideIds.length)

      if (rideIds.length === 0) {
        console.log('❌ No rides found for user')
        return []
      }

      // Get the actual ride details - using departure_date instead of start_time
      const now = new Date()
      const today = now.toISOString().split('T')[0] // YYYY-MM-DD format
      
      const { data: rides, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'active')
        .gte('departure_date', today) // Use departure_date instead of start_time
        .in('id', rideIds)
        .order('departure_date', { ascending: true })
        .order('departure_time', { ascending: true })

      if (error) {
        console.error('Error fetching upcoming rides:', error)
        return []
      }

      console.log('✅ Found upcoming rides:', rides?.length || 0)
      
      // Log ride details for debugging
      rides?.forEach(ride => {
        const rideDateTime = new Date(`${ride.departure_date}T${ride.departure_time}`)
        const minutesUntilStart = (rideDateTime.getTime() - now.getTime()) / (1000 * 60)
        console.log(`🚙 Ride "${ride.title}": ${ride.departure_date} ${ride.departure_time} (${Math.round(minutesUntilStart)} min until start)`)
      })

      return rides || []
    } catch (error) {
      console.error('Error in getUserUpcomingRides:', error)
      return []
    }
  },

  // Check if ride should be live (within 10 minutes of departure)
  isRideLive(ride: Ride): boolean {
    const now = new Date()
    
    // Combine departure_date and departure_time
    const rideStart = new Date(`${ride.departure_date}T${ride.departure_time}`)
    const timeDifference = rideStart.getTime() - now.getTime()
    const minutesUntilStart = timeDifference / (1000 * 60)

    console.log(`🕐 Checking if ride "${ride.title}" should be live:`)
    console.log(`   Now: ${now.toISOString()}`)
    console.log(`   Ride start: ${rideStart.toISOString()}`)
    console.log(`   Minutes until start: ${Math.round(minutesUntilStart)}`)
    console.log(`   Has started_at: ${!!ride.started_at}`)

    // Activate 10 minutes before start time
    if (minutesUntilStart > 10) {
      console.log(`   ❌ Too early (${Math.round(minutesUntilStart)} > 10 minutes)`)
      return false // Too early
    }

    // If ride has been manually started (has started_at timestamp), keep it live longer
    if (ride.started_at) {
      const shouldBeLive = minutesUntilStart >= -240 // 4 hours after start for manually started rides
      console.log(`   🚀 Manually started - should be live: ${shouldBeLive}`)
      return shouldBeLive
    }

    // For rides that haven't been manually started, expire 45 minutes after scheduled start
    const shouldBeLive = minutesUntilStart >= -45 // Auto-expire 45 minutes after scheduled start
    console.log(`   ⏰ Auto-mode - should be live: ${shouldBeLive} (expires at -45 min)`)
    return shouldBeLive
  },

  // Get rides that should be live for a user
  async getUserLiveRides(userId: string): Promise<Ride[]> {
    try {
      const upcomingRides = await this.getUserUpcomingRides(userId)
      const liveRides = upcomingRides.filter(ride => this.isRideLive(ride))
      
      // Clean up any expired live_rides entries
      await this.cleanupExpiredLiveRides(upcomingRides, liveRides)
      
      return liveRides
    } catch (error) {
      console.error('Error in getUserLiveRides:', error)
      return []
    }
  },

  // Clean up expired live rides from the database
  async cleanupExpiredLiveRides(allRides: Ride[], currentLiveRides: Ride[]): Promise<void> {
    try {
      const liveRideIds = currentLiveRides.map(r => r.id)
      const expiredRides = allRides.filter(ride => 
        !liveRideIds.includes(ride.id) && 
        !this.isRideLive(ride)
      )

      if (expiredRides.length > 0) {
        console.log(`Cleaning up ${expiredRides.length} expired live rides`)
        
        // Remove expired live_rides entries
        const { error } = await supabase
          .from('live_rides')
          .delete()
          .in('ride_id', expiredRides.map(r => r.id))
          .neq('status', 'completed') // Don't delete completed rides

        if (error) {
          console.error('Error cleaning up expired live rides:', error)
        }
      }
    } catch (error) {
      console.error('Error in cleanupExpiredLiveRides:', error)
    }
  },

  // Get time until ride becomes live or expires
  getRideTimeStatus(ride: Ride): {
    status: 'upcoming' | 'live' | 'expired'
    minutesUntil: number
    message: string
  } {
    const now = new Date()
    const rideStart = new Date(`${ride.departure_date}T${ride.departure_time}`)
    const timeDifference = rideStart.getTime() - now.getTime()
    const minutesUntilStart = timeDifference / (1000 * 60)

    if (minutesUntilStart > 10) {
      return {
        status: 'upcoming',
        minutesUntil: minutesUntilStart,
        message: `Becomes live in ${Math.ceil(minutesUntilStart - 10)} minutes`
      }
    }

    if (ride.started_at) {
      return {
        status: 'live',
        minutesUntil: minutesUntilStart,
        message: 'Ride started by driver'
      }
    }

    if (minutesUntilStart >= -30) {
      const minutesRemaining = 30 + minutesUntilStart
      return {
        status: 'live',
        minutesUntil: minutesUntilStart,
        message: minutesUntilStart > 0 
          ? `Live - starts in ${Math.ceil(minutesUntilStart)} minutes`
          : `Live - expires in ${Math.ceil(minutesRemaining)} minutes`
      }
    }

    return {
      status: 'expired',
      minutesUntil: minutesUntilStart,
      message: 'Ride expired (30 minutes after start time)'
    }
  },

  // Subscribe to real-time updates for a ride
  subscribeToRide(rideId: string, callback: (payload: any) => void): RealtimeChannel {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_rides',
          filter: `ride_id=eq.${rideId}`
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_requests',
          filter: `ride_id=eq.${rideId}`
        },
        callback
      )
      .subscribe()

    return channel
  },

  // Unsubscribe from real-time updates
  unsubscribeFromRide(channel: RealtimeChannel) {
    supabase.removeChannel(channel)
  }
}

// Utility functions
export const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const formatDate = (timestamp: string): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

export const getStatusMessage = (status: string, isDriver: boolean): string => {
  switch (status) {
    case 'upcoming':
      return isDriver ? 'Ready to start your ride' : 'Waiting for driver to start'
    case 'live':
      return isDriver ? 'Ride in progress' : 'Ride started - driver is on the way'
    case 'completed':
      return 'Ride completed'
    case 'cancelled':
      return 'Ride cancelled'
    default:
      return 'Unknown status'
  }
}

export const getPickupStatusMessage = (status: string): string => {
  switch (status) {
    case 'waiting':
      return 'Waiting for pickup'
    case 'picked_up':
      return 'Picked up'
    case 'dropped_off':
      return 'Dropped off'
    default:
      return 'Unknown status'
  }
}
