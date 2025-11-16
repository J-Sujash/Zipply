/**
 * Unified Notification Manager
 * Handles both in-app toasts and push notifications
 * Shows in-app toast when app is active, push notification when app is inactive
 */

import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { pushNotificationService } from './pushNotifications';

interface NotificationData {
  title: string;
  message: string;
  data?: any;
  type?: string;
}

interface InAppToastListener {
  (notification: NotificationData): void;
}

class NotificationManager {
  private static instance: NotificationManager;
  private appState: AppStateStatus = AppState.currentState;
  private inAppToastListeners: InAppToastListener[] = [];
  private isInitialized = false;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Initialize the notification manager
   */
  async initialize(userId?: string) {
    if (this.isInitialized) return;

    console.log('🔔 Initializing Notification Manager...');

    // Listen to app state changes
    AppState.addEventListener('change', this.handleAppStateChange);

    // Listen to incoming notifications
    Notifications.addNotificationReceivedListener(this.handleNotificationReceived);

    // Initialize push notifications if user is provided
    if (userId) {
      try {
        await pushNotificationService.initialize(userId);
        console.log('✅ Push notifications initialized for user:', userId);
      } catch (error) {
        console.error('❌ Failed to initialize push notifications:', error);
      }
    }

    this.isInitialized = true;
    console.log('✅ Notification Manager initialized');
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`📱 App state changed: ${this.appState} -> ${nextAppState}`);
    this.appState = nextAppState;
  };

  /**
   * Handle incoming notifications
   */
  private handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('🔔 Notification received:', notification);

    const notificationData: NotificationData = {
      title: notification.request.content.title || 'Notification',
      message: notification.request.content.body || '',
      data: notification.request.content.data,
      type: notification.request.content.data?.type as string | undefined,
    };

    // If app is active, show in-app toast
    if (this.isAppActive()) {
      console.log('📱 App is active - showing in-app toast');
      this.showInAppToast(notificationData);
    } else {
      console.log('📱 App is inactive - notification will show as push notification');
      // Push notification will be handled automatically by the system
    }
  };

  /**
   * Check if app is currently active
   */
  private isAppActive(): boolean {
    return this.appState === 'active';
  }

  /**
   * Show in-app toast notification
   */
  private showInAppToast(notification: NotificationData) {
    this.inAppToastListeners.forEach(listener => {
      listener(notification);
    });
  }

  /**
   * Send a notification (will be in-app toast if active, push if inactive)
   */
  async sendNotification(notification: NotificationData) {
    console.log('🔔 Sending notification:', notification);

    if (this.isAppActive()) {
      // App is active - show in-app toast
      console.log('📱 Showing in-app toast');
      this.showInAppToast(notification);
    } else {
      // App is inactive - send push notification
      console.log('📱 Sending push notification');
      await this.sendPushNotification(notification);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: NotificationData) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: notification.data || {},
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
      console.log('✅ Push notification sent');
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
    }
  }

  /**
   * Subscribe to in-app toast notifications
   */
  subscribeToInAppToasts(listener: InAppToastListener): () => void {
    this.inAppToastListeners.push(listener);
    
    return () => {
      const index = this.inAppToastListeners.indexOf(listener);
      if (index > -1) {
        this.inAppToastListeners.splice(index, 1);
      }
    };
  }

  /**
   * Simulate a notification (for testing)
   */
  async testNotification() {
    await this.sendNotification({
      title: 'Test Notification 🔔',
      message: 'This is a test notification to verify the system is working!',
      data: { type: 'test' },
    });
  }

  /**
   * Handle ride created notification
   */
  async notifyRideCreated(rideTitle: string, departureDate: string, departureTime: string) {
    await this.sendNotification({
      title: 'Ride Created! 🚗',
      message: `Your ride "${rideTitle}" is now live and accepting passengers`,
      data: { 
        type: 'ride_created',
        ride_title: rideTitle,
        departure_date: departureDate,
        departure_time: departureTime,
      },
    });
  }

  /**
   * Handle ride request notification
   */
  async notifyRideRequest(passengerName: string, rideTitle: string, rideId: string) {
    await this.sendNotification({
      title: 'New Ride Request! 🙋‍♂️',
      message: `${passengerName} wants to join your ride "${rideTitle}"`,
      data: { 
        type: 'ride_request',
        ride_id: rideId,
        passenger_name: passengerName,
      },
    });
  }

  /**
   * Handle request approved notification
   */
  async notifyRequestApproved(rideTitle: string, driverName: string) {
    await this.sendNotification({
      title: 'Request Approved! ✅',
      message: `${driverName} approved your request for "${rideTitle}"`,
      data: { 
        type: 'request_approved',
        ride_title: rideTitle,
        driver_name: driverName,
      },
    });
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.isInitialized) {
      // Note: AppState.removeEventListener is deprecated in newer React Native versions
      // The subscription is automatically cleaned up when the component unmounts
      this.inAppToastListeners = [];
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();

// Convenience functions
export const initializeNotificationManager = (userId?: string) => notificationManager.initialize(userId);
export const sendNotification = (notification: NotificationData) => notificationManager.sendNotification(notification);
export const subscribeToInAppToasts = (listener: InAppToastListener) => notificationManager.subscribeToInAppToasts(listener);
export const testNotification = () => notificationManager.testNotification();

// Specific notification functions
export const notifyRideCreated = (rideTitle: string, departureDate: string, departureTime: string) => 
  notificationManager.notifyRideCreated(rideTitle, departureDate, departureTime);

export const notifyRideRequest = (passengerName: string, rideTitle: string, rideId: string) => 
  notificationManager.notifyRideRequest(passengerName, rideTitle, rideId);

export const notifyRequestApproved = (rideTitle: string, driverName: string) => 
  notificationManager.notifyRequestApproved(rideTitle, driverName);
