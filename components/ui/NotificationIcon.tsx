import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BellIcon } from './Icons';
import { NotificationBadge } from './NotificationBadge';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadNotificationCount } from '../../lib/notifications';

interface NotificationIconProps {
  size?: number;
  color?: string;
  onPress?: () => void;
}

export function NotificationIcon({ 
  size = 24, 
  color = Colors.text,
  onPress 
}: NotificationIconProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      
      // Set up interval to check for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      
      return () => clearInterval(interval);
    } else {
      console.log('🔔 No user found, cannot fetch notifications');
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const { count } = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/notifications');
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <View style={styles.iconContainer}>
        <BellIcon size={size} color={color} />
        <NotificationBadge 
          count={unreadCount}
          size="small"
          color={Colors.primary}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
});
