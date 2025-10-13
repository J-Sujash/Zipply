import { supabase } from './supabase';

export type NotificationType = 
  | 'ride_request' 
  | 'request_approved' 
  | 'request_rejected' 
  | 'ride_cancelled' 
  | 'ride_reminder'
  | 'ride_created'
  | 'system';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRideId?: string;
  relatedRequestId?: string;
}

/**
 * Creates a new notification in the database
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedRideId,
  relatedRequestId,
}: CreateNotificationParams) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_ride_id: relatedRideId,
        related_request_id: relatedRequestId,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { data: null, error };
  }
}

/**
 * Creates a notification when someone requests to join a ride
 */
export async function notifyRideRequest(
  driverId: string,
  passengerName: string,
  rideTitle: string,
  rideId: string,
  requestId: string
) {
  return createNotification({
    userId: driverId,
    type: 'ride_request',
    title: 'New Ride Request',
    message: `${passengerName} wants to join your ride "${rideTitle}". Review their request in the Requests tab.`,
    relatedRideId: rideId,
    relatedRequestId: requestId,
  });
}

/**
 * Creates a notification for the requester when they request a ride
 */
export async function notifyRideRequestSent(
  passengerId: string,
  driverName: string,
  rideTitle: string,
  rideId: string,
  requestId: string
) {
  return createNotification({
    userId: passengerId,
    type: 'ride_request',
    title: 'Ride Request Sent! 📤',
    message: `Your request to join "${rideTitle}" by ${driverName} has been sent. You'll be notified when the driver responds.`,
    relatedRideId: rideId,
    relatedRequestId: requestId,
  });
}

/**
 * Creates a notification when a ride request is approved
 */
export async function notifyRequestApproved(
  passengerId: string,
  driverName: string,
  rideTitle: string,
  rideId: string,
  requestId: string
) {
  return createNotification({
    userId: passengerId,
    type: 'request_approved',
    title: 'Request Approved! 🎉',
    message: `Great news! ${driverName} approved your request for "${rideTitle}". Check your ride details for pickup information.`,
    relatedRideId: rideId,
    relatedRequestId: requestId,
  });
}

/**
 * Creates a notification when a ride request is rejected
 */
export async function notifyRequestRejected(
  passengerId: string,
  driverName: string,
  rideTitle: string,
  rideId: string,
  requestId: string
) {
  return createNotification({
    userId: passengerId,
    type: 'request_rejected',
    title: 'Request Not Approved',
    message: `Unfortunately, ${driverName} couldn't approve your request for "${rideTitle}". Don't worry, there are other rides available!`,
    relatedRideId: rideId,
    relatedRequestId: requestId,
  });
}

/**
 * Creates a notification when a ride is cancelled
 */
export async function notifyRideCancelled(
  userId: string,
  rideTitle: string,
  rideId: string,
  isDriver: boolean = false
) {
  const title = isDriver ? 'Ride Cancelled' : 'Ride Cancelled by Driver';
  const message = isDriver 
    ? `Your ride "${rideTitle}" has been cancelled. Passengers have been notified.`
    : `The ride "${rideTitle}" has been cancelled by the driver. We apologize for any inconvenience.`;

  return createNotification({
    userId,
    type: 'ride_cancelled',
    title,
    message,
    relatedRideId: rideId,
  });
}

/**
 * Creates a reminder notification for upcoming rides
 */
export async function notifyRideReminder(
  userId: string,
  rideTitle: string,
  departureTime: string,
  rideId: string,
  isDriver: boolean = false
) {
  const role = isDriver ? 'driver' : 'passenger';
  const title = `Ride Reminder - ${isDriver ? 'You\'re Driving' : 'Upcoming Trip'}`;
  const message = `Don't forget! Your ride "${rideTitle}" is scheduled for ${departureTime}. ${
    isDriver 
      ? 'Make sure to contact your passengers if needed.' 
      : 'Make sure to be ready for pickup on time.'
  }`;

  return createNotification({
    userId,
    type: 'ride_reminder',
    title,
    message,
    relatedRideId: rideId,
  });
}

/**
 * Creates a notification when a driver creates a new ride
 */
export async function notifyRideCreated(
  userId: string,
  rideTitle: string,
  departureDate: string,
  departureTime: string,
  rideId: string
) {
  const formattedDate = new Date(departureDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  
  const [hours, minutes] = departureTime.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return createNotification({
    userId,
    type: 'ride_created',
    title: 'Ride Created Successfully! 🚗',
    message: `Your ride "${rideTitle}" has been created for ${formattedDate} at ${formattedTime}. Students can now find and request to join your ride!`,
    relatedRideId: rideId,
  });
}

/**
 * Creates a system notification (welcome message, updates, etc.)
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string
) {
  return createNotification({
    userId,
    type: 'system',
    title,
    message,
  });
}

/**
 * Creates welcome notification for new users
 */
export async function notifyWelcome(userId: string, firstName: string) {
  return notifySystem(
    userId,
    'Welcome to Zipply! 🚗',
    `Hi ${firstName}! Welcome to Zipply, your college carpooling companion. Start by exploring available rides or create your own to help fellow students get around campus and beyond.`
  );
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return { error };
  }
}

/**
 * Gets unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return { count: 0, error };
  }
}

/**
 * Deletes old notifications (older than 30 days) for a user
 */
export async function cleanupOldNotifications(userId: string) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return { error };
  }
}
