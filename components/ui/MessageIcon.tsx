import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MessageIcon } from './Icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/Colors';
import { getUnreadMessageCount } from '../../lib/messaging';

interface MessageIconProps {
  size?: number;
  color?: string;
}

export const MessageIconWithBadge: React.FC<MessageIconProps> = ({ 
  size = 24, 
  color = Colors.text 
}) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadMessageCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  };

  const handlePress = () => {
    router.push('/messages/' as any);
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
