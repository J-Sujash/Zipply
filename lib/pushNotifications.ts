/**
 * Professional Push Notification System for Zipply
 * Handles Expo push notifications, tokens, and in-app notifications
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_CONFIG } from './config';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  userId: string;
  deviceId: string;
  platform: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;
  private inAppNotifications: InAppNotification[] = [];
  private listeners: ((notifications: InAppNotification[]) => void)[] = [];

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notifications
   */
  async initialize(userId: string): Promise<string | null> {
    try {
      console.log('🔔 Initializing push notifications...');

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.warn('⚠️ Push notifications only work on physical devices');
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Push notification permissions denied');
        return null;
      }

      // Get push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.warn('⚠️ No Expo project ID found');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.expoPushToken = tokenData.data;
      console.log('✅ Got Expo push token:', this.expoPushToken);

      // Save token to server
      await this.saveTokenToServer(userId, this.expoPushToken);

      // Set up notification listeners
      this.setupNotificationListeners();

      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to server
   */
  private async saveTokenToServer(userId: string, token: string): Promise<void> {
    try {
      const deviceId = Constants.deviceId || 'unknown';
      const platform = Platform.OS;

      // Try to save via API first (preferred method)
      try {
        const response = await fetch(`${this.getServerUrl()}/api/push-notifications/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAuthToken()}`,
          },
          body: JSON.stringify({
            token: token,
            device_id: deviceId,
            platform: platform,
          }),
        });

        if (response.ok) {
          console.log('✅ Push token saved via API');
          return;
        } else {
          console.warn('⚠️ API token save failed, falling back to direct database');
        }
      } catch (apiError) {
        console.warn('⚠️ API not available, using direct database save');
      }

      // Fallback to direct database save
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: token,
          device_id: deviceId,
          platform: platform,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        console.error('❌ Error saving push token:', error);
      } else {
        console.log('✅ Push token saved to database');
      }
    } catch (error) {
      console.error('❌ Error saving push token to server:', error);
    }
  }

  private getServerUrl(): string {
    return API_CONFIG.SERVER_URL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // Handle notifications received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received in foreground:', notification);
      this.addInAppNotification(notification);
    });

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped:', response);
      this.handleNotificationTap(response);
    });
  }

  /**
   * Add in-app notification
   */
  private addInAppNotification(notification: Notifications.Notification): void {
    const inAppNotif: InAppNotification = {
      id: notification.request.identifier,
      title: notification.request.content.title || 'Notification',
      body: notification.request.content.body || '',
      data: notification.request.content.data,
      timestamp: new Date(),
      read: false,
    };

    this.inAppNotifications.unshift(inAppNotif);
    
    // Keep only last 50 notifications
    if (this.inAppNotifications.length > 50) {
      this.inAppNotifications = this.inAppNotifications.slice(0, 50);
    }

    this.notifyListeners();
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    
    // Handle different notification types
    if (data?.type === 'ride_request') {
      // Navigate to requests page
      console.log('🚗 Navigate to ride request:', data.rideId);
    } else if (data?.type === 'message') {
      // Navigate to messages
      console.log('💬 Navigate to message:', data.conversationId);
    }
  }

  /**
   * Get in-app notifications
   */
  getInAppNotifications(): InAppNotification[] {
    return this.inAppNotifications;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.inAppNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }

  /**
   * Clear all in-app notifications
   */
  clearAllNotifications(): void {
    this.inAppNotifications = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to in-app notification updates
   */
  subscribe(listener: (notifications: InAppNotification[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener([...this.inAppNotifications]);
    });
  }

  /**
   * Send test notification (for development)
   */
  async sendTestNotification(): Promise<void> {
    if (!this.expoPushToken) {
      console.warn('⚠️ No push token available');
      return;
    }

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: this.expoPushToken,
          title: 'Test Notification 🔔',
          body: 'This is a test notification from Zipply!',
          data: { type: 'test' },
        }),
      });
      
      console.log('✅ Test notification sent');
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Convenience functions
export const initializePushNotifications = (userId: string) => 
  pushNotificationService.initialize(userId);

export const getInAppNotifications = () => 
  pushNotificationService.getInAppNotifications();

export const markNotificationAsRead = (id: string) => 
  pushNotificationService.markAsRead(id);

export const clearAllNotifications = () => 
  pushNotificationService.clearAllNotifications();

export const subscribeToNotifications = (listener: (notifications: InAppNotification[]) => void) => 
  pushNotificationService.subscribe(listener);

export const sendTestNotification = () => 
  pushNotificationService.sendTestNotification();
