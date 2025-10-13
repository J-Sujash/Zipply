import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getUserConversations, 
  getConversationPartner, 
  formatMessageTime,
  subscribeToUserConversations,
  subscribeToMessageUpdates,
  markMessagesAsRead,
  type Conversation 
} from '../../lib/messaging';
import { Card } from '../../components/ui/Card';
import { 
  ArrowLeftIcon, 
  MessageIcon, 
  UserIcon,
  SearchIcon 
} from '../../components/ui/Icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/Colors';

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

  const fetchConversations = useCallback(async () => {
    try {
      console.log('📱 Fetching conversations...');
      const data = await getUserConversations();
      setConversations(data);
      setLastFetchTime(new Date());
      console.log(`✅ Loaded ${data.length} conversations`);
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
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

  const handleConversationPress = async (conversation: Conversation) => {
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
    
    const partner = getConversationPartner(item, user.id);
    const lastMessage = item.last_message;
    const isUnread = (item.unread_count || 0) > 0;

    return (
      <TouchableOpacity
        onPress={() => handleConversationPress(item)}
        style={styles.conversationContainer}
      >
        <Card variant="outlined" style={StyleSheet.flatten([
          styles.conversationCard,
          isUnread && styles.unreadCard,
          isUnread && (item.unread_count || 0) > 5 && styles.highPriorityCard
        ])}>
          {/* Profile Picture */}
          <View style={styles.avatarContainer}>
            {partner?.profile_picture_url ? (
              <Image 
                source={{ uri: partner.profile_picture_url }} 
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserIcon size={24} color={Colors.textSecondary} />
              </View>
            )}
            {isUnread && <UnreadDotIndicator />}
          </View>

          {/* Conversation Info */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text style={[
                styles.partnerName,
                isUnread && styles.unreadText
              ]}>
                {partner?.first_name && partner?.last_name 
                  ? `${partner.first_name} ${partner.last_name}` 
                  : 'Unknown User'}
              </Text>
              <View style={styles.conversationMeta}>
                <View style={[
                  styles.roleBadge,
                  { backgroundColor: partner?.role === 'driver' ? Colors.primary + '20' : Colors.success + '20' }
                ]}>
                  <Text style={[
                    styles.roleText,
                    { color: partner?.role === 'driver' ? Colors.primary : Colors.success }
                  ]}>
                    {partner?.role === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
                  </Text>
                </View>
                {lastMessage && (
                  <Text style={styles.timestamp}>
                    {formatMessageTime(lastMessage.created_at)}
                  </Text>
                )}
              </View>
            </View>

            {/* Ride Info */}
            {item.ride && (
              <View style={styles.rideInfo}>
                <Text style={styles.rideRoute} numberOfLines={1}>
                  {item.ride.departure_location} → {item.ride.destination_location}
                </Text>
              </View>
            )}

            {/* Last Message */}
            {lastMessage && (
              <View style={styles.lastMessageContainer}>
                <Text 
                  style={[
                    styles.lastMessage,
                    isUnread && styles.unreadText
                  ]} 
                  numberOfLines={2}
                >
                  {lastMessage.message_type === 'system' ? '📢 ' : ''}
                  {lastMessage.content}
                </Text>
              </View>
            )}

          </View>

          {/* Unread Count - Positioned in top right */}
          {isUnread && (
            <View style={styles.unreadBadgePosition}>
              <UnreadBadge count={item.unread_count || 0} />
            </View>
          )}
        </Card>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeftIcon size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
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
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          {conversations.length > 0 && (
            <View style={styles.headerStats}>
              <Text style={styles.conversationCount}>
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </Text>
              {(() => {
                const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                return totalUnread > 0 ? (
                  <View style={styles.totalUnreadBadge}>
                    <Text style={styles.totalUnreadText}>
                      {totalUnread > 99 ? '99+' : totalUnread} new
                    </Text>
                  </View>
                ) : null;
              })()
              }
            </View>
          )}
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          conversations.length === 0 && styles.emptyListContainer
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
    backgroundColor: Colors.white,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
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
    padding: Spacing.lg,
  },
  emptyListContainer: {
    flex: 1,
  },
  conversationContainer: {
    marginBottom: Spacing.md,
  },
  conversationCard: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
    borderColor: Colors.primary + '30',
  },
  highPriorityCard: {
    borderLeftColor: Colors.error,
    backgroundColor: Colors.error + '08',
    borderColor: Colors.error + '30',
    shadowColor: Colors.error,
    shadowOpacity: 0.15,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  partnerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  conversationMeta: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  rideInfo: {
    marginBottom: Spacing.sm,
  },
  rideRoute: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
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
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
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
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
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
