/**
 * Global Notification Provider
 * Manages in-app toast notifications across the entire app
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { initializeNotificationManager, subscribeToInAppToasts } from '../../lib/notificationManager';

interface NotificationData {
  title: string;
  message: string;
  data?: any;
  type?: string;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize notification manager with user ID
      console.log('🔔 Initializing notification manager for user:', user.id);
      initializeNotificationManager(user.id);
    }
  }, [user]);

  useEffect(() => {
    // Subscribe to in-app toast notifications
    const unsubscribe = subscribeToInAppToasts((notification) => {
      console.log('📱 Received in-app toast:', notification);
      // For now, just log - we'll handle toast display separately
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <View style={styles.container}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
