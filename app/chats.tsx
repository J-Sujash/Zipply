import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageIcon,
  SearchIcon
} from '../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { messagingApi } from '../lib/apiClient';
import { formatMessageTime } from '../lib/messaging';

// Global declaration for development mode
declare const __DEV__: boolean;

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  role?: 'driver' | 'passenger';
}

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.35;


export default function ChatsScreen() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const startEntranceAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchContacts = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      console.log('💬 Fetching conversations from application server...');
      
      // Fetch conversations from the application server API
      const conversations = await messagingApi.getConversations();
      if (__DEV__) {
        console.log('💬 Fetched conversations count:', conversations.length);
      }
      
      // Transform server response into Contact format
      const transformedContacts: Contact[] = conversations.map((conversation: any) => {
        // Determine user role and partner info
        const userRole = conversation.driver_id === user.id ? 'driver' : 'passenger';
        const partnerRole = userRole === 'driver' ? 'passenger' : 'driver';
        
        // Get partner name and profile picture from server response
        let partnerName = 'Unknown User';
        let partnerProfilePicture = null;
        
        if (userRole === 'driver' && conversation.passenger_name) {
          partnerName = conversation.passenger_name;
          partnerProfilePicture = conversation.passenger_profile_picture;
        } else if (userRole === 'passenger' && conversation.driver_name) {
          partnerName = conversation.driver_name;
          partnerProfilePicture = conversation.driver_profile_picture;
        }
        
        // Format last message time if available
        const lastMessageTime = conversation.last_message_time ? 
          formatMessageTime(conversation.last_message_time) : 
          '';
        
        const contact: Contact = {
          id: conversation.id,
          name: partnerName,
          avatar: partnerProfilePicture || undefined,
          lastMessage: conversation.last_message_content || 'No messages yet',
          lastMessageTime,
          unreadCount: conversation.unread_count || 0,
          isOnline: Math.random() > 0.5, // TODO: Implement real online status from server
          role: partnerRole as 'driver' | 'passenger'
        };
        
        if (__DEV__) {
          console.log('💬 Contact:', partnerName, 'Avatar URL:', partnerProfilePicture, 'Role:', partnerRole);
          console.log('💬 Raw conversation data:', {
            passenger_profile_picture: conversation.passenger_profile_picture,
            driver_profile_picture: conversation.driver_profile_picture,
            partner_profile_picture: conversation.partner_profile_picture
          });
        }
        
        return contact;
      });
      
      if (__DEV__) {
        console.log('💬 Transformed contacts count:', transformedContacts.length);
      }
      setContacts(transformedContacts);
      
    } catch (error) {
      console.error('💬 Error fetching conversations:', error);
      
      // Fallback to empty array on error
      setContacts([]);
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContacts(true);
  }, [fetchContacts]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (!loading) {
      startEntranceAnimation();
    }
  }, [loading, startEntranceAnimation]);

  // Set up periodic refresh every 30 seconds for conversation updates
  useEffect(() => {
    if (!user?.id) return;

    if (__DEV__) {
      console.log('💬 Setting up periodic conversation refresh...');
    }
    
    const interval = setInterval(() => {
      if (__DEV__) {
        console.log('💬 Periodic refresh: updating conversations...');
      }
      fetchContacts(true);
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (__DEV__) {
        console.log('💬 Cleaning up periodic refresh');
      }
      clearInterval(interval);
    };
  }, [user?.id, fetchContacts]);

  const getAvatarColor = (name: string) => {
    const colors = [Colors.primary, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getRoleBadgeColor = (role: 'driver' | 'passenger') => {
    return role === 'driver' ? Colors.primary : '#10B981';
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity 
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginVertical: 4,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
      onPress={() => router.push(`/messages/${item.id}`)}
    >
      <View style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: getAvatarColor(item.name),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        overflow: 'hidden',
      }}>
        {item.avatar && item.avatar.trim() !== '' && item.avatar !== 'null' ? (
          <Image 
            source={{ uri: item.avatar }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
            }}
            onError={(error) => {
              if (__DEV__) {
                console.log('❌ Image failed to load for', item.name, ':', item.avatar, error);
              }
            }}
            onLoad={() => {
              if (__DEV__) {
                console.log('✅ Image loaded successfully for', item.name, ':', item.avatar);
              }
            }}
          />
        ) : (
          <>
            {__DEV__ && console.log('🔄 Using fallback avatar for', item.name, 'Avatar value:', item.avatar)}
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: Colors.white,
            }}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </>
        )}
        
        {/* Role Badge */}
        <View style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: getRoleBadgeColor(item.role || 'passenger'),
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: Colors.background,
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: Colors.white,
          }}>
            {item.role === 'driver' ? '🚗' : '👤'}
          </Text>
        </View>
      </View>
      
      <View style={{ flex: 1 }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: Colors.text,
              flex: 1,
            }} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              backgroundColor: getRoleBadgeColor(item.role || 'passenger') + '20',
              marginRight: 8,
            }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                color: getRoleBadgeColor(item.role || 'passenger'),
              }}>
                {item.role === 'driver' ? 'DRIVER' : 'PASSENGER'}
              </Text>
            </View>
          </View>
          <Text style={{
            fontSize: 12,
            color: Colors.textSecondary,
          }}>
            {item.lastMessageTime}
          </Text>
        </View>
        
        <Text style={{
          fontSize: 14,
          color: Colors.textSecondary,
        }} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderContactsList = () => (
    <Animated.View style={[
      { flex: 1 },
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }
    ]}>
      <View style={styles.modernHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <View style={styles.backButtonContainer}>
            <Text style={styles.backButtonText}>‹</Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.modernHeaderTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {contacts.length} conversation{contacts.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.modernSearchContainer}>
        <SearchIcon size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.modernSearchInput}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.modernLoadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.modernLoadingText}>Loading conversations...</Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.modernEmptyState}>
          <View style={styles.emptyIconContainer}>
            <MessageIcon size={32} color={Colors.primary} />
          </View>
          <Text style={styles.modernEmptyTitle}>No conversations yet</Text>
          <Text style={styles.modernEmptySubtitle}>
            Start chatting with other riders and drivers to see your conversations here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts.filter(contact =>
            contact.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          style={styles.modernContactsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modernContactsListContent}
        />
      )}
    </Animated.View>
  );


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {renderContactsList()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Modern Header Styles
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  modernHeaderTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  backButton: {
    padding: 4,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: Colors.text,
    marginLeft: -1,
  },
  // Modern Search Styles
  modernSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modernSearchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 4,
  },
  // Modern Loading Styles
  modernLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modernLoadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Modern Empty State
  modernEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modernEmptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modernEmptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Modern Contacts List
  modernContactsList: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  modernContactsListContent: {
    paddingBottom: Spacing.xl,
  },
  // Modern Contact Item Styles
  contactItemContainer: {
    marginVertical: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactAvatar: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  contactTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: FontSize.xs - 1,
    fontWeight: 'bold',
    color: Colors.white,
  },
  contactFooter: {
    marginBottom: 8,
  },
  lastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
