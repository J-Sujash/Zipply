import { supabase } from './supabase';
import { getEligibleRidesForRating } from './ratingsApi';

/**
 * Create notifications for users to rate their completed rides
 */
export async function createRatingReminders() {
  try {
    // Get all users who have completed rides in the last 48 hours
    const { data: completedRides, error: ridesError } = await supabase
      .from('rides')
      .select(`
        id,
        title,
        driver_id,
        departure_date,
        departure_time,
        ride_requests!inner (
          passenger_id,
          status
        )
      `)
      .eq('status', 'completed')
      .eq('ride_requests.status', 'approved')
      .gte('departure_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('departure_date', new Date().toISOString().split('T')[0]);

    if (ridesError) throw ridesError;

    const notifications = [];
    const processedUsers = new Set<string>();

    for (const ride of completedRides || []) {
      // Check for driver
      if (!processedUsers.has(ride.driver_id)) {
        const eligibleRides = await getEligibleRidesForRating(ride.driver_id);
        if (eligibleRides.length > 0) {
          notifications.push({
            user_id: ride.driver_id,
            type: 'rating_reminder',
            title: 'Rate Your Recent Rides',
            message: `You have ${eligibleRides.length} completed ride${eligibleRides.length > 1 ? 's' : ''} waiting for ratings. Rate within 48 hours!`,
            related_ride_id: ride.id,
          });
          processedUsers.add(ride.driver_id);
        }
      }

      // Check for passengers
      for (const request of ride.ride_requests) {
        if (!processedUsers.has(request.passenger_id)) {
          const eligibleRides = await getEligibleRidesForRating(request.passenger_id);
          if (eligibleRides.length > 0) {
            notifications.push({
              user_id: request.passenger_id,
              type: 'rating_reminder',
              title: 'Rate Your Recent Rides',
              message: `You have ${eligibleRides.length} completed ride${eligibleRides.length > 1 ? 's' : ''} waiting for ratings. Rate within 48 hours!`,
              related_ride_id: ride.id,
            });
            processedUsers.add(request.passenger_id);
          }
        }
      }
    }

    // Insert notifications (avoid duplicates by checking existing notifications)
    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .upsert(notifications, { 
          onConflict: 'user_id,type,related_ride_id',
          ignoreDuplicates: true 
        });

      if (notificationError) throw notificationError;
    }

    return { success: true, count: notifications.length };
  } catch (error: any) {
    console.error('Error creating rating reminders:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending rating count for a user
 */
export async function getPendingRatingCount(userId: string): Promise<number> {
  try {
    const eligibleRides = await getEligibleRidesForRating(userId);
    return eligibleRides.length;
  } catch (error) {
    console.error('Error getting pending rating count:', error);
    return 0;
  }
}

/**
 * Mark rating reminder as read when user visits rating screen
 */
export async function markRatingReminderAsRead(userId: string, rideId?: string) {
  try {
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', 'rating_reminder');

    if (rideId) {
      query = query.eq('related_ride_id', rideId);
    }

    const { error } = await query;
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error marking rating reminder as read:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Database function to automatically create rating reminders
 * This should be called by a scheduled job or trigger
 */
export const createRatingReminderFunction = `
CREATE OR REPLACE FUNCTION create_rating_reminders()
RETURNS void AS $$
DECLARE
    ride_record RECORD;
    user_record RECORD;
    eligible_count INTEGER;
BEGIN
    -- Get completed rides from the last 48 hours
    FOR ride_record IN 
        SELECT DISTINCT r.id, r.title, r.driver_id, r.departure_date, r.departure_time
        FROM rides r
        JOIN ride_requests rr ON r.id = rr.ride_id
        WHERE r.status = 'completed'
        AND rr.status = 'approved'
        AND r.departure_date >= CURRENT_DATE - INTERVAL '2 days'
        AND r.departure_date <= CURRENT_DATE
    LOOP
        -- Check driver for eligible ratings
        SELECT COUNT(*) INTO eligible_count
        FROM get_eligible_users_to_rate(ride_record.id, ride_record.driver_id)
        WHERE NOT already_rated;
        
        IF eligible_count > 0 THEN
            INSERT INTO notifications (user_id, type, title, message, related_ride_id)
            VALUES (
                ride_record.driver_id,
                'rating_reminder',
                'Rate Your Recent Rides',
                'You have ' || eligible_count || ' completed ride' || 
                CASE WHEN eligible_count > 1 THEN 's' ELSE '' END || 
                ' waiting for ratings. Rate within 48 hours!',
                ride_record.id
            )
            ON CONFLICT (user_id, type, related_ride_id) DO NOTHING;
        END IF;
        
        -- Check passengers for eligible ratings
        FOR user_record IN 
            SELECT DISTINCT rr.passenger_id as user_id
            FROM ride_requests rr
            WHERE rr.ride_id = ride_record.id
            AND rr.status = 'approved'
        LOOP
            SELECT COUNT(*) INTO eligible_count
            FROM get_eligible_users_to_rate(ride_record.id, user_record.user_id)
            WHERE NOT already_rated;
            
            IF eligible_count > 0 THEN
                INSERT INTO notifications (user_id, type, title, message, related_ride_id)
                VALUES (
                    user_record.user_id,
                    'rating_reminder',
                    'Rate Your Recent Rides',
                    'You have ' || eligible_count || ' completed ride' || 
                    CASE WHEN eligible_count > 1 THEN 's' ELSE '' END || 
                    ' waiting for ratings. Rate within 48 hours!',
                    ride_record.id
                )
                ON CONFLICT (user_id, type, related_ride_id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
`;

/**
 * Schedule rating reminders to run daily
 */
export const scheduleRatingReminders = `
-- Create a scheduled job to run rating reminders daily
-- This requires pg_cron extension to be enabled
SELECT cron.schedule('rating-reminders', '0 9 * * *', 'SELECT create_rating_reminders();');
`;
