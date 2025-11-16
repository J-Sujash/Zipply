import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    MessageIcon,
    SearchIcon
} from '../../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { messagingApi } from '../../lib/apiClient';
import {
    formatMessageTime,
    markMessagesAsRead,
    subscribeToMessageUpdates,
    subscribeToUserConversations,
    type Conversation
} from '../../lib/messagingService';

// FORCE CACHE REFRESH - Messages connected to application server
const CACHE_BUSTER = '2025-10-25-01:17:00-MESSAGES-SERVER-CONNECTION';
console.log('🔥 MESSAGES SERVER CONNECTION:', CACHE_BUSTER);
console.log('🔥 MESSAGES: Now connected to application server via API client!');

// Animated Unread Dot Component
const UnreadDotIndicator = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    scaleAnimation.start();

    return () => {
      pulseAnimation.stop();
      scaleAnimation.stop();
    };
  }, [pulseAnim, scaleAnim]);

  return (
    <View style={styles.unreadDotContainer}>
      <Animated.View 
        style={[
          styles.unreadDotPulse,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.4],
              outputRange: [0.6, 0.1],
            }),
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.unreadDot,
          {
            transform: [{ scale: scaleAnim }],
          }
        ]} 
      />
    </View>
  );
};

// Animated Unread Badge Component
const UnreadBadge = ({ count }: { count: number }) => {
  const glowAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    glowAnimation.start();
    bounceAnimation.start();

    return () => {
      glowAnimation.stop();
      bounceAnimation.stop();
    };
  }, [glowAnim, bounceAnim]);

  const isHighPriority = count > 5;
  const backgroundColor = isHighPriority ? Colors.error : Colors.primary;
  const minWidth = count > 9 ? 20 : 18;

  return (
    <View style={styles.unreadBadgeContainer}>
      <Animated.View 
        style={[
          styles.unreadGlow,
          {
            backgroundColor: backgroundColor + '30',
            transform: [{ scale: glowAnim }],
            opacity: glowAnim.interpolate({
              inputRange: [1, 1.2],
              outputRange: [0.4, 0.1],
            }),
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.unreadBadge,
          {
            backgroundColor,
            minWidth,
            transform: [{ scale: bounceAnim }],
          }
        ]}
      >
        <Text style={styles.unreadCount}>
          {count > 99 ? '99+' : count}
        </Text>
      </Animated.View>
    </View>
  );
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'driver' | 'passenger'>('all');

  useEffect(() => {
    if (user) {
      fetchConversations();
      
      // Subscribe to real-time conversation updates
      const conversationSubscription = subscribeToUserConversations(user.id, () => {
        console.log('🔄 Refreshing conversations due to real-time update');
        fetchConversations();
      });

      // Subscribe to message read status updates
      const messageSubscription = subscribeToMessageUpdates(user.id, () => {
        console.log('📖 Refreshing conversations due to message update');
        fetchConversations();
      });

      return () => {
        console.log('🧹 Cleaning up message subscriptions');
        conversationSubscription.unsubscribe();
        messageSubscription.unsubscribe();
      };
    }
  }, [user]);

  const filterExpiredConversations = async (conversations: Conversation[]): Promise<Conversation[]> => {
    if (!conversations || conversations.length === 0) return [];
    
    try {
      // Check each conversation to see if messaging is still enabled
      const activeConversations: Conversation[] = [];
      
      for (const conversation of conversations) {
        if (conversation.ride_id) {
          try {
            // Check if messaging is disabled for this ride
            const status = await messagingApi.checkMessagingStatus(conversation.ride_id);
            
            if (!status.messaging_disabled) {
              activeConversations.push(conversation);
            } else if (__DEV__) {
              console.log(`🧹 MESSAGES: Filtered expired conversation for ride ${conversation.ride_id}: ${status.reason}`);
            }
          } catch (error) {
            // If we can't check the status, keep the conversation to be safe
            activeConversations.push(conversation);
          }
        } else {
          // If no ride_id, keep the conversation
          activeConversations.push(conversation);
        }
      }
      
      return activeConversations;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ MESSAGES: Error filtering expired conversations');
      }
      // Return all conversations if filtering fails
      return conversations;
    }
  };

  const fetchConversations = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('📱 MESSAGES: Fetching conversations');
      }
      
      // Use the new fast messaging API that includes real user names
      const data = await messagingApi.getConversations();
      
      // Filter out expired conversations (rides that started 45+ minutes ago)
      const activeConversations = await filterExpiredConversations(data);
      
      setConversations(activeConversations);
      setLastFetchTime(new Date());
      
      if (__DEV__) {
        console.log(`✅ MESSAGES: Loaded ${activeConversations.length} active conversations`);
        if (data.length > activeConversations.length) {
          console.log(`🧹 MESSAGES: Filtered out ${data.length - activeConversations.length} expired conversations`);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ MESSAGES: Error fetching conversations');
      }
      Alert.alert('Error', 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh conversations when returning to this screen
  useEffect(() => {
    const handleFocus = () => {
      const timeSinceLastFetch = new Date().getTime() - lastFetchTime.getTime();
      // Refresh if it's been more than 5 seconds since last fetch
      if (timeSinceLastFetch > 5000) {
        console.log('🔄 Auto-refreshing conversations on screen focus');
        fetchConversations();
      }
    };

    // Set up focus listener for when user returns to this screen
    const focusListener = () => {
      handleFocus();
    };
    
    // Clean up function
    return () => {
      // Cleanup if needed
    };
  }, [lastFetchTime, fetchConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  const getFilteredConversations = () => {
    if (!user || activeFilter === 'all') return conversations;
    
    return conversations.filter(conversation => {
      if (activeFilter === 'driver') {
        return conversation.driver_id === user.id;
      } else if (activeFilter === 'passenger') {
        return conversation.passenger_id === user.id;
      }
      return true;
    });
  };

  const handleDeleteConversations = async () => {
    try {
      // Show confirmation alert
      Alert.alert(
        'Delete Conversations',
        `Are you sure you want to delete ${selectedConversations.size} conversation(s)? This will only delete them for you.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Delete conversations for current user only
              for (const conversationId of selectedConversations) {
                try {
                  // Call API to hide conversation for current user
                  await messagingApi.hideConversation(conversationId);
                } catch (error) {
                  console.error(`Failed to delete conversation ${conversationId}:`, error);
                }
              }
              
              // Remove deleted conversations from UI
              setConversations(prev => 
                prev.filter(conv => !selectedConversations.has(conv.id))
              );
              
              // Reset edit mode
              setIsEditMode(false);
              setSelectedConversations(new Set());
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting conversations:', error);
      Alert.alert('Error', 'Failed to delete conversations. Please try again.');
    }
  };

  const handleConversationPress = async (conversation: Conversation) => {
    if (isEditMode) {
      // Toggle selection in edit mode
      const newSelected = new Set(selectedConversations);
      if (newSelected.has(conversation.id)) {
        newSelected.delete(conversation.id);
      } else {
        newSelected.add(conversation.id);
      }
      setSelectedConversations(newSelected);
      return;
    }

    try {
      // Optimistically update UI - mark as read immediately
      if ((conversation.unread_count || 0) > 0) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversation.id 
              ? { ...conv, unread_count: 0 }
              : conv
          )
        );
        
        // Mark messages as read in background
        await markMessagesAsRead(conversation.id);
        console.log(`📖 Marked conversation ${conversation.id} as read`);
      }
      
      // Navigate to conversation
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      console.error('Error handling conversation press:', error);
      // Revert optimistic update on error
      fetchConversations();
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    if (!user) return null;
    
    // Use enriched data from the fast messaging API
    const enrichedItem = item as any;
    const isDriver = item.driver_id === user.id;
    const isSelected = selectedConversations.has(item.id);
    
    // Get partner info from enriched conversation data with profile pictures
    const partnerName = isDriver 
      ? enrichedItem.passenger_name || 'Passenger'
      : enrichedItem.driver_name || 'Driver';
    
    const partnerProfilePicture = isDriver 
      ? enrichedItem.passenger_profile_picture_url
      : enrichedItem.driver_profile_picture_url;
    
    const partner = {
      first_name: partnerName.split(' ')[0] || 'User',
      last_name: partnerName.split(' ').slice(1).join(' ') || '',
      role: isDriver ? 'passenger' : 'driver',
      profile_picture_url: partnerProfilePicture
    };
    
    const lastMessage = item.last_message;
    const isUnread = (item.unread_count || 0) > 0;
    const messageTime = lastMessage ? formatMessageTime(lastMessage.created_at) : '';

    return (
      <TouchableOpacity
        onPress={() => handleConversationPress(item)}
        style={[
          styles.conversationRow,
          isSelected && styles.selectedConversationRow
        ]}
        activeOpacity={0.7}
      >
        {/* Selection Circle or Profile Picture */}
        <View style={styles.avatarContainer}>
          {isEditMode ? (
            <View style={[
              styles.selectionCircle,
              isSelected && styles.selectedCircle
            ]}>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {partner?.profile_picture_url ? (
                <Image 
                  source={{ uri: partner.profile_picture_url }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {partnerName[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {isUnread && <UnreadDotIndicator />}
            </>
          )}
        </View>

        {/* Conversation Content - iOS Messages Style */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.partnerName,
              isUnread && styles.unreadText
            ]}>
              {partnerName}
            </Text>
            {messageTime && (
              <Text style={[
                styles.timestamp,
                isUnread && styles.unreadTimestamp
              ]}>
                {messageTime}
              </Text>
            )}
          </View>

          {/* Role Badge */}
          <View style={styles.roleBadgeContainer}>
            <View style={[
              styles.roleBadge,
              isDriver ? styles.driverBadge : styles.passengerBadge
            ]}>
              <Text style={[
                styles.roleBadgeText,
                isDriver ? styles.driverBadgeText : styles.passengerBadgeText
              ]}>
                {isDriver ? 'Driver' : 'Passenger'}
              </Text>
            </View>
          </View>

          {/* Last Message */}
          <View style={styles.lastMessageRow}>
            {lastMessage ? (
              <Text 
                style={[
                  styles.lastMessage,
                  isUnread && styles.unreadLastMessage
                ]} 
                numberOfLines={2}
              >
                {lastMessage.content}
              </Text>
            ) : (
              <Text style={styles.lastMessage}>
                No messages yet
              </Text>
            )}
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unread_count || 0}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MessageIcon size={64} color={Colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptyText}>
        Start conversations with drivers and passengers when you join or offer rides.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/(tabs)/search')}
      >
        <SearchIcon size={20} color={Colors.white} />
        <Text style={styles.emptyButtonText}>Find Rides</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Modern Messages Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isEditMode ? (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setIsEditMode(false);
                setSelectedConversations(new Set());
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={styles.editButtonText}>
              {isEditMode ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'all' && styles.activeFilterTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'driver' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('driver')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'driver' && styles.activeFilterTabText]}>Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeFilter === 'passenger' && styles.activeFilterTab]}
          onPress={() => setActiveFilter('passenger')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'passenger' && styles.activeFilterTabText]}>Passenger</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search</Text>
        </View>
      </View>

      {/* Delete Button */}
      {isEditMode && selectedConversations.size > 0 && (
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteConversations}
          >
            <Text style={styles.deleteButtonText}>
              Delete ({selectedConversations.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conversations List */}
      <FlatList
        data={getFilteredConversations()}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          getFilteredConversations().length === 0 && styles.emptyListContainer
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#475569',
    fontWeight: '600',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
  },
  editButtonText: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  // Modern Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterTab: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#94A3B8',
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '400',
  },
  headerStats: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  conversationCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  totalUnreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  totalUnreadText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '700',
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
  listContainer: {
    paddingTop: 0,
  },
  emptyListContainer: {
    flex: 1,
  },
  // Modern conversation rows
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedConversationRow: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
    marginTop: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unreadDotContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  unreadDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.white,
    zIndex: 2,
  },
  unreadDotPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error + '40',
    zIndex: 1,
  },
  // Conversation content styles
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  partnerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    lineHeight: 22,
  },
  unreadText: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    marginLeft: 8,
    marginTop: 1,
  },
  unreadTimestamp: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  rideRoute: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 15,
    color: '#64748B',
    flex: 1,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  unreadLastMessage: {
    color: '#1E293B',
    fontWeight: '500',
  },
  unreadBadgePosition: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  unreadBadgeContainer: {
    position: 'relative',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
    marginTop: 1,
    shadowColor: '#EF4444',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '30',
    zIndex: -1,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleBadgeContainer: {
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  driverBadge: {
    backgroundColor: '#10B981',
  },
  passengerBadge: {
    backgroundColor: '#3B82F6',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  driverBadgeText: {
    color: '#FFFFFF',
  },
  passengerBadgeText: {
    color: '#FFFFFF',
  },
  selectionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkmark: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  deleteButtonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
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
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
