import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { ApiNotification, notificationApi } from '../lib/apiClient';
import { getUnreadMessageCount } from '../lib/messagingService';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
    ArrowLeftIcon,
    CheckIcon,
    TrashIcon,
    XIcon,
} from '../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';

// PERFORMANCE OPTIMIZATION - Caching for instant loading
const CACHE_BUSTER = '2025-10-27-00:48:00-PERFORMANCE-OPTIMIZATION';
if (__DEV__) {
  console.log('⚡ NOTIFICATIONS: Performance optimization enabled');
}

// Use the API notification type
type Notification = ApiNotification & {
  isRead: boolean;
  createdAt: string;
  relatedRideId?: string;
  relatedRequestId?: string;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [cachedNotifications, setCachedNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadMessageCount();
  }, [user]);

  // Auto-refresh notifications every 2 minutes (less aggressive)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing && user) {
        console.log('🔄 Auto-refreshing notifications...');
        fetchNotifications();
        fetchUnreadMessageCount();
      }
    }, 120000); // 2 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [loading, refreshing, user]);

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Notifications screen focused - refreshing...');
      fetchNotifications();
      fetchUnreadMessageCount();
    }, [])
  );

  const fetchUnreadMessageCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadMessageCount();
      setUnreadMessageCount(count);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  };

  const fetchNotifications = async (forceRefresh = false) => {
    if (!user) {
      console.log('⚠️ No user authenticated, skipping notification fetch');
      return;
    }

    // PERFORMANCE: Use cache if data is fresh (less than 20 seconds old)
    const now = Date.now();
    const cacheAge = now - lastFetchTime;
    const cacheValid = cacheAge < 20000; // 20 seconds

    if (!forceRefresh && cacheValid && cachedNotifications.length >= 0) {
      if (__DEV__) {
        console.log('⚡ CACHE HIT: Using cached data (age:', Math.round(cacheAge / 1000), 'seconds)');
      }
      setNotifications(cachedNotifications);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      if (__DEV__) {
        console.log('⚡ NOTIFICATIONS: Fetching from server');
      }
      
      // Fetch notifications from server API
      const serverNotifications = await notificationApi.getNotifications();
      
      if (__DEV__) {
        console.log('📱 NOTIFICATIONS: Received', serverNotifications?.length || 0, 'notifications');
      }

      if (!Array.isArray(serverNotifications)) {
        throw new Error('Invalid response format from server');
      }

      // ROBUST MAPPING - Handle any missing fields
      const formattedNotifications: Notification[] = serverNotifications.map((notification, index) => {
        const formatted = {
          id: notification.id || `missing-id-${index}`,
          user_id: notification.user_id || user.id,
          type: notification.type || 'system',
          title: notification.title || 'No Title',
          message: notification.message || 'No Message',
          is_read: Boolean(notification.is_read),
          created_at: notification.created_at || new Date().toISOString(),
          related_ride_id: notification.related_ride_id || undefined,
          related_request_id: notification.related_request_id || undefined,
          // Legacy format for compatibility
          isRead: Boolean(notification.is_read),
          createdAt: notification.created_at || new Date().toISOString(),
          relatedRideId: notification.related_ride_id || undefined,
          relatedRequestId: notification.related_request_id || undefined,
        };
        
        return formatted;
      });

      // Check if we got any notifications
      if (formattedNotifications.length === 0) {
        if (__DEV__) {
          console.log('ℹ️ NO NOTIFICATIONS: No notifications found');
        }
      } else {
        if (__DEV__) {
          console.log('🎉 NOTIFICATIONS: Successfully loaded', formattedNotifications.length, 'notifications');
        }
      }
      
      setNotifications(formattedNotifications);
      setCachedNotifications(formattedNotifications); // Cache the results
      setLastFetchTime(Date.now()); // Update cache timestamp
      
      if (__DEV__) {
        console.log('✅ NOTIFICATIONS: State updated with', formattedNotifications.length, 'items');
        console.log('⚡ CACHE: Updated for 20 seconds');
      }
      
      // Force loading to false
      setLoading(false);
      setRefreshing(false);
      
    } catch (error: any) {
      console.error('❌ Failed to fetch notifications:', error);
      
      let errorMessage = 'Unable to load notifications';
      if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('server')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication error. Please sign in again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      if (__DEV__) {
        console.log('📖 NOTIFICATIONS: Marking notification as read');
      }
      
      // Mark notification as read via server API
      await notificationApi.markAsRead(notificationId);

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
      
      if (__DEV__) {
        console.log('✅ NOTIFICATIONS: Notification marked as read');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ NOTIFICATIONS: Error marking notification as read');
      }
      Alert.alert('Error', 'Failed to mark notification as read. Please try again.');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      if (unreadCount === 0) return;

      if (__DEV__) {
        console.log('📖 NOTIFICATIONS: Marking all notifications as read');
      }
      
      // Mark all notifications as read via server API
      await notificationApi.markAllAsRead();

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      if (__DEV__) {
        console.log('✅ NOTIFICATIONS: All notifications marked as read');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ NOTIFICATIONS: Error marking all notifications as read');
      }
      Alert.alert('Error', 'Failed to mark all notifications as read.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      if (__DEV__) {
        console.log('🗑️ NOTIFICATIONS: Deleting single notification');
      }
      
      // Delete notification via server API
      await notificationApi.deleteNotification(notificationId);

      // Update local state immediately
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      
      // Update cached notifications as well
      setCachedNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      
      if (__DEV__) {
        console.log('✅ NOTIFICATIONS: Single notification deleted');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ NOTIFICATIONS: Error deleting notification');
      }
      Alert.alert('Error', 'Failed to delete notification. Please try again.');
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.size === 0) return;

    Alert.alert(
      'Delete Selected Notifications',
      `Are you sure you want to delete ${selectedNotifications.size} notification${selectedNotifications.size === 1 ? '' : 's'}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const idsToDelete = Array.from(selectedNotifications);
              if (__DEV__) {
                console.log('🗑️ NOTIFICATIONS: Deleting', idsToDelete.length, 'selected notifications');
              }
              
              // Delete selected notifications via server API
              await notificationApi.deleteNotifications(idsToDelete);
              
              // Update local state immediately
              setNotifications(prev => 
                prev.filter(notification => !selectedNotifications.has(notification.id))
              );
              
              // Update cached notifications as well
              setCachedNotifications(prev => 
                prev.filter(notification => !selectedNotifications.has(notification.id))
              );
              
              // Reset selection state
              setSelectedNotifications(new Set());
              setSelectionMode(false);
              
              if (__DEV__) {
                console.log('✅ NOTIFICATIONS: Bulk delete completed successfully');
              }
              
            } catch (error) {
              if (__DEV__) {
                console.error('❌ NOTIFICATIONS: Error in bulk delete operation');
              }
              Alert.alert('Error', 'Failed to delete selected notifications. Please try again.');
            }
          }
        }
      ]
    );
  };

  const toggleSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = filteredNotifications.map(n => n.id);
    setSelectedNotifications(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedNotifications(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedNotifications(new Set());
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              if (__DEV__) {
                console.log('🗑️ NOTIFICATIONS: Clearing all notifications');
              }
              
              // Clear all notifications via server API
              await notificationApi.clearAllNotifications();

              // Update local state immediately
              setNotifications([]);
              setCachedNotifications([]);
              
              if (__DEV__) {
                console.log('✅ NOTIFICATIONS: All notifications cleared');
              }
              
              // Refresh unread message count
              fetchUnreadMessageCount();
            } catch (error) {
              if (__DEV__) {
                console.error('❌ NOTIFICATIONS: Error clearing all notifications');
              }
              Alert.alert('Error', 'Failed to clear notifications. Please try again.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (__DEV__) {
      console.log('🔄 NOTIFICATIONS: Force refresh triggered');
    }
    fetchNotifications(true); // Force refresh bypasses cache
    fetchUnreadMessageCount();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'ride_request':
        return '🚗';
      case 'request_approved':
        return '✅';
      case 'request_rejected':
        return '❌';
      case 'ride_cancelled':
        return '🚫';
      case 'ride_reminder':
        return '⏰';
      case 'system':
        return '📢';
      default:
        return '📱';
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'ride_request':
        return Colors.primary;
      case 'request_approved':
        return '#10B981';
      case 'request_rejected':
        return '#EF4444';
      case 'ride_cancelled':
        return '#F59E0B';
      case 'ride_reminder':
        return '#8B5CF6';
      case 'system':
        return '#6B7280';
      default:
        return Colors.textSecondary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    return true;
  });
  
  // Development-only render debugging
  if (__DEV__) {
    console.log('🔍 NOTIFICATIONS RENDER:', {
      total: notifications.length,
      filtered: filteredNotifications.length,
      loading,
      hasError: !!error
    });
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationPress = (notification: Notification) => {
    if (selectionMode) {
      toggleSelection(notification.id);
      return;
    }

    // Mark as read if unread
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate to requests page based on notification type
    if (notification.type === 'ride_request' || 
        notification.type === 'request_approved' || 
        notification.type === 'request_rejected') {
      // Navigate to requests page with "My Requests" tab selected
      router.push({
        pathname: '/(tabs)/requests',
        params: { tab: 'outgoing', requestId: notification.relatedRequestId }
      });
    } else if (notification.relatedRideId) {
      // For other ride-related notifications, go to ride details
      router.push(`/ride/${notification.relatedRideId}`);
    }
  };

  const handleNotificationLongPress = (notification: Notification) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedNotifications(new Set([notification.id]));
    } else {
      toggleSelection(notification.id);
    }
  };

  const renderNotificationCard = (notification: Notification) => {
    const isSelected = selectedNotifications.has(notification.id);
    const cardStyle = StyleSheet.flatten([
      styles.notificationCard,
      !notification.isRead && styles.unreadCard,
      isSelected && styles.selectedCard,
      selectionMode && styles.selectionModeCard
    ]);

    return (
      <TouchableOpacity
        key={notification.id}
        onPress={() => handleNotificationPress(notification)}
        onLongPress={() => handleNotificationLongPress(notification)}
        activeOpacity={0.7}
      >
        <Card 
          variant="elevated" 
          style={cardStyle}
        >
          <View style={styles.notificationHeader}>
            <View style={styles.notificationLeft}>
              {selectionMode && (
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleSelection(notification.id)}
                >
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected
                  ]}>
                    {isSelected && (
                      <CheckIcon size={14} color={Colors.white} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              <View style={[
                styles.iconContainer,
                { backgroundColor: getNotificationColor(notification.type) + '15' }
              ]}>
                <Text style={styles.notificationIcon}>
                  {getNotificationIcon(notification.type)}
                </Text>
              </View>
              <View style={styles.notificationContent}>
                <Text style={[
                  styles.notificationTitle,
                  !notification.isRead && styles.unreadTitle
                ]}>
                  {notification.title}
                </Text>
                <Text style={styles.notificationTime}>
                  {formatTime(notification.createdAt)}
                </Text>
              </View>
            </View>
            {!selectionMode && !notification.isRead && (
              <View style={styles.unreadDot} />
            )}
          </View>
          
          <Text style={[
            styles.notificationMessage,
            selectionMode && styles.selectionModeMessage
          ]}>
            {notification.message}
          </Text>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={selectionMode ? exitSelectionMode : () => router.back()}
          style={styles.backButton}
        >
          {selectionMode ? (
            <XIcon size={24} color={Colors.text} />
          ) : (
            <ArrowLeftIcon size={24} color={Colors.text} />
          )}
        </TouchableOpacity>
        <Text style={styles.title}>
          {selectionMode 
            ? `${selectedNotifications.size} Selected`
            : 'Notifications'
          }
        </Text>
        {selectionMode ? (
          <TouchableOpacity
            onPress={deleteSelectedNotifications}
            style={styles.deleteButton}
            disabled={selectedNotifications.size === 0}
          >
            <TrashIcon size={20} color={selectedNotifications.size > 0 ? Colors.error : Colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setSelectionMode(true)}
            style={styles.selectButton}
            disabled={filteredNotifications.length === 0}
          >
            <Text style={[
              styles.selectText,
              filteredNotifications.length === 0 && styles.disabledText
            ]}>
              Select
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {selectionMode && (
        <View style={styles.selectionControls}>
          <TouchableOpacity
            onPress={selectedNotifications.size === filteredNotifications.length ? deselectAll : selectAll}
            style={styles.selectionControlButton}
          >
            <Text style={styles.selectionControlText}>
              {selectedNotifications.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={markAllAsRead}
            style={styles.selectionControlButton}
            disabled={unreadCount === 0}
          >
            <Text style={[
              styles.selectionControlText,
              unreadCount === 0 && styles.disabledText
            ]}>
              Mark All Read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectionMode && (
        <View style={styles.filterContainer}>
          <View style={styles.filterWrapper}>
            {(['all', 'unread'] as const).map((filterOption, index) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  filter === filterOption && styles.activeFilterButton,
                ]}
                onPress={() => setFilter(filterOption)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.activeFilterButtonText,
                ]}>
                  {filterOption === 'all' 
                    ? `All (${notifications.length})` 
                    : `Unread (${unreadCount})`
                  }
                </Text>
                {filterOption === 'unread' && unreadCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Messages count section */}
          <View style={styles.messagesSection}>
            <View style={styles.messagesSectionHeader}>
              <Text style={styles.messagesSectionTitle}>Messages</Text>
              <TouchableOpacity
                style={styles.messagesButton}
                onPress={() => router.push('/messages')}
              >
                <Text style={styles.messagesIcon}>💬</Text>
                <Text style={styles.messagesButtonText}>View Messages</Text>
                {unreadMessageCount > 0 && (
                  <View style={styles.messagesBadge}>
                    <Text style={styles.messagesBadgeText}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.messagesSectionSubtitle}>
              {unreadMessageCount > 0 
                ? `You have ${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`
                : 'No unread messages'
              }
            </Text>
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={fetchNotifications}
            style={styles.retryButton}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🔔</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'unread' 
                  ? "You're all caught up! No unread notifications."
                  : "You don't have any notifications yet. They'll appear here when you receive them."
                }
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsContainer}>
              {filteredNotifications.map(renderNotificationCard)}
              
              {notifications.length > 0 && !selectionMode && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearAllNotifications}
                >
                  <Text style={styles.clearAllText}>Clear All Notifications</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  markAllButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  markAllText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  disabledText: {
    color: Colors.textSecondary,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  filterWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 1,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 36,
  },
  activeFilterButton: {
    backgroundColor: Colors.white,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonText: {
    fontSize: FontSize.sm,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  activeFilterButtonText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  notificationCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadCard: {
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
    borderColor: Colors.primary + '20',
  },
  selectedCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
    borderLeftColor: Colors.primary,
  },
  selectionModeCard: {
    transform: [{ scale: 0.98 }],
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs, // Reduced margin
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  iconContainer: {
    width: 32, // Smaller icon container
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  notificationIcon: {
    fontSize: 16, // Smaller icon
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  notificationMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginLeft: 44,
  },
  selectionModeMessage: {
    marginLeft: 76, // Account for checkbox space
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  notificationsContainer: {
    paddingTop: Spacing.sm,
  },
  clearAllButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  messagesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  messagesSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  messagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  messagesIcon: {
    fontSize: FontSize.sm,
    marginRight: Spacing.xs,
  },
  messagesButtonText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  messagesBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
    paddingHorizontal: 4,
  },
  messagesBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  messagesSectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // Selection Mode Styles
  deleteButton: {
    padding: Spacing.sm,
  },
  selectButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  selectText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectionControlButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  selectionControlText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  // Checkbox Styles
  checkboxContainer: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
