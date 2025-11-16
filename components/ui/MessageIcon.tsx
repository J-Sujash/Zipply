import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadMessageCount } from '../../lib/messaging';
import { MessageIcon } from './Icons';

interface MessageIconProps {
  size?: number;
  color?: string;
}

export const MessageIconWithBadge: React.FC<MessageIconProps> = ({ 
  size = 24, 
  color = Colors.text 
}) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      
      // Refresh count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    } else {
      console.log(' No user found, cannot fetch message count');
      setUnreadCount(0);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadMessageCount();
      if (__DEV__) {
        console.log('💬 Unread message count:', count);
      }
      setUnreadCount(count);
    } catch (error) {
      if (__DEV__) {
        console.error('💬 Error fetching unread message count:', error);
      }
      setUnreadCount(0);
    }
  };

  const handlePress = () => {
    if (__DEV__) {
      console.log('💬 Message icon pressed, navigating to chats');
    }
    router.push('/chats');
  };


  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <View style={styles.iconContainer}>
        <MessageIcon size={size} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xs,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.xs - 2,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
