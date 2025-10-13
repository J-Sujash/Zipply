import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  subscribeToConversationMessages,
  getUserConversations,
  getConversationPartner,
  type Message,
  type Conversation,
} from '../../lib/messaging';
import { Card } from '../../components/ui/Card';
import {
  ArrowLeftIcon,
  UserIcon,
  PlusIcon,
  LocationIcon,
} from '../../components/ui/Icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/Colors';

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversationId && user) {
      fetchConversationData();
      fetchMessages();

      // Subscribe to new messages
      const subscription = subscribeToConversationMessages(
        conversationId,
        (newMessage) => {
          console.log('💬 Real-time: New message in chat', newMessage.content);
          setMessages((prev) => {
            // Avoid duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          
          // Auto-scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          
          // Mark new messages as read immediately if they're from others
          if (newMessage.sender_id !== user.id) {
            setTimeout(() => {
              markMessagesAsRead(conversationId);
            }, 500);
          }
        }
      );

      return () => {
        console.log('🧹 Cleaning up chat subscription');
        subscription.unsubscribe();
      };
    }
  }, [conversationId, user]);

  useEffect(() => {
    // Mark messages as read when screen is focused and when new messages arrive
    if (conversationId && messages.length > 0) {
      const unreadMessages = messages.filter(msg => !msg.is_read && msg.sender_id !== user?.id);
      if (unreadMessages.length > 0) {
        console.log(`📖 Marking ${unreadMessages.length} messages as read`);
        markMessagesAsRead(conversationId);
      }
    }
  }, [conversationId, messages, user?.id]);

  const fetchConversationData = async () => {
    try {
      const conversations = await getUserConversations();
      const currentConversation = conversations.find(c => c.id === conversationId);
      setConversation(currentConversation || null);
    } catch (error) {
      console.error('Error fetching conversation data:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      console.log('📱 Fetching messages for conversation:', conversationId);
      const data = await getConversationMessages(conversationId);
      setMessages(data);
      console.log(`✅ Loaded ${data.length} messages`);
      
      // Auto-scroll to bottom after loading messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
      // Mark messages as read after loading
      if (data.length > 0) {
        setTimeout(() => {
          markMessagesAsRead(conversationId);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      console.log('💬 Sending message:', text);
      const sentMessage = await sendMessage(conversationId, text);
      
      // Optimistically add message to UI immediately
      setMessages((prev) => {
        const exists = prev.some(msg => msg.id === sentMessage.id);
        if (exists) return prev;
        return [...prev, sentMessage];
      });
      
      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(text); // Restore message text on error
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const messageTime = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    // For messages older than 24 hours, show time
    return messageTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!user) return null;

    const isMyMessage = item.sender_id === user.id;
    const isSystemMessage = item.message_type === 'system';
    const showAvatar = !isMyMessage && !isSystemMessage;
    const showTimestamp = index === 0 || 
      (messages[index - 1] && 
       new Date(item.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000); // 5 minutes

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
          <Text style={styles.systemMessageTime}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {showAvatar && (
          <View style={styles.avatarContainer}>
            {item.sender?.profile_picture_url ? (
              <Image 
                source={{ uri: item.sender.profile_picture_url }} 
                style={styles.messageAvatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserIcon size={16} color={Colors.textSecondary} />
              </View>
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          !showAvatar && !isMyMessage && styles.messageWithoutAvatar
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          
          {showTimestamp && (
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(item.created_at)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (!conversation || !user) return null;

    const partner = getConversationPartner(conversation, user.id);

    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            {partner?.profile_picture_url ? (
              <Image 
                source={{ uri: partner.profile_picture_url }} 
                style={styles.headerAvatarImage}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <UserIcon size={20} color={Colors.textSecondary} />
              </View>
            )}
          </View>
          
          <View style={styles.headerText}>
            <Text style={styles.headerName}>
              {partner?.first_name && partner?.last_name 
                ? `${partner.first_name} ${partner.last_name}` 
                : 'Unknown User'}
            </Text>
            <View style={styles.headerMeta}>
              <View style={[
                styles.headerRoleBadge,
                { backgroundColor: partner?.role === 'driver' ? Colors.primary + '20' : Colors.success + '20' }
              ]}>
                <Text style={[
                  styles.headerRoleText,
                  { color: partner?.role === 'driver' ? Colors.primary : Colors.success }
                ]}>
                  {partner?.role === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.rideInfoButton}
          onPress={() => conversation.ride_id && router.push(`/ride/${conversation.ride_id}`)}
        >
          <LocationIcon size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderRideInfo = () => {
    if (!conversation?.ride) return null;

    return (
      <Card variant="outlined" style={styles.rideInfoCard}>
        <View style={styles.rideInfoContent}>
          <LocationIcon size={16} color={Colors.primary} />
          <Text style={styles.rideInfoText} numberOfLines={1}>
            {conversation.ride.departure_location} → {conversation.ride.destination_location}
          </Text>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {renderRideInfo()}
        
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) && styles.sendButtonDisabled
              ]}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: Spacing.md,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRoleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  headerRoleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  rideInfoButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '10',
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
  chatContainer: {
    flex: 1,
  },
  rideInfoCard: {
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.primary + '05',
    borderColor: Colors.primary + '20',
  },
  rideInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rideInfoText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
    fontWeight: '500',
  },
  messagesContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: Spacing.sm,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.sm,
  },
  otherMessageBubble: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageWithoutAvatar: {
    marginLeft: 44, // Avatar width + margin
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  myMessageTime: {
    color: Colors.white + 'CC',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: Colors.textSecondary,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  systemMessage: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  systemMessageText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  inputContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
