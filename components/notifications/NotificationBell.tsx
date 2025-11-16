/**
 * Notification Bell Component
 * Shows notification count and triggers dropdown
 */

import React, { useEffect, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors, FontSize } from '../../constants/Colors';
import { InAppNotification, subscribeToNotifications } from '../../lib/pushNotifications';
import { BellIcon } from '../ui/Icons';

interface NotificationBellProps {
  onPress: () => void;
  size?: number;
  color?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onPress,
  size = 24,
  color = Colors.text,
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = subscribeToNotifications(setNotifications);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Pulse animation when new unread notifications arrive
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <Animated.View style={[styles.bellContainer, { transform: [{ scale: pulseAnim }] }]}>
        <BellIcon size={size} color={color} />
        
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bellContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
