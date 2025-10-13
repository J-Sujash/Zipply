import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUnreadMessageCount } from '../lib/messaging';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  ArrowLeftIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
} from '../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors';

interface Notification {
  id: string;
  type: 'ride_request' | 'request_approved' | 'request_rejected' | 'ride_cancelled' | 'ride_reminder' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedRideId?: string;
  relatedRequestId?: string;
}

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

  useEffect(() => {
    fetchNotifications();
    fetchUnreadMessageCount();
  }, [user]);

  const fetchUnreadMessageCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadMessageCount();
      setUnreadMessageCount(count);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedNotifications: Notification[] = (data || []).map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.is_read,
        createdAt: notification.created_at,
        relatedRideId: notification.related_ride_id,
        relatedRequestId: notification.related_request_id,
      }));

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.isRead)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification.');
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
              const { error } = await supabase
                .from('notifications')
                .delete()
                .in('id', idsToDelete);

              if (error) throw error;

              setNotifications(prev => 
                prev.filter(notification => !selectedNotifications.has(notification.id))
              );
              setSelectedNotifications(new Set());
              setSelectionMode(false);
            } catch (error) {
              console.error('Error deleting selected notifications:', error);
              Alert.alert('Error', 'Failed to delete selected notifications.');
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
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user?.id);

              if (error) throw error;
              setNotifications([]);
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
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
