import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftIcon,
    LocationIcon,
} from '../../components/ui/Icons';
import { Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { messagingApi } from '../../lib/apiClient';
import {
    markMessagesAsRead,
    subscribeToConversationMessages,
    type Conversation,
    type Message,
} from '../../lib/messagingService';

// Modern Chat Message Interface
interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isCurrentUser: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  avatar?: string;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_sender_name?: string;
}

// Convert Message to ChatMessage format
const convertMessage = (message: Message, currentUserId: string): ChatMessage => {
  const messageData = message as any;
  
  // Handle reply context from both server API and real-time subscription formats
  let replyContent = messageData.reply_to_content;
  let replySenderName = messageData.reply_to_sender_name;
  
  // If we have nested reply_message data (from real-time subscription)
  if (messageData.reply_message) {
    replyContent = messageData.reply_message.content;
    if (messageData.reply_message.sender) {
      const { first_name, last_name } = messageData.reply_message.sender;
      replySenderName = `${first_name || ''} ${last_name || ''}`.trim() || 'User';
    }
  }
  
  // Get sender name from different possible formats
  let senderName = 'U';
  if (messageData.sender_name) {
    senderName = messageData.sender_name[0]?.toUpperCase() || 'U';
  } else if (messageData.sender) {
    const { first_name, last_name } = messageData.sender;
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();
    senderName = fullName[0]?.toUpperCase() || 'U';
  }
  
  return {
    id: message.id,
    content: message.content,
    senderId: message.sender_id,
    timestamp: new Date(message.created_at),
    isCurrentUser: message.sender_id === currentUserId,
    status: message.sender_id === currentUserId ? 'read' : undefined,
    avatar: senderName,
    reply_to_message_id: messageData.reply_to_message_id,
    reply_to_content: replyContent,
    reply_to_sender_name: replySenderName,
  };
};

const { width: screenWidth } = Dimensions.get('window');

// Helper function for avatar colors
const getAvatarColor = (name: string) => {
  const colors = [Colors.primary, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  
  // Helper functions for partner info
  const getPartnerProfilePicture = () => {
    if (!conversation || !user) return null;
    const enrichedConv = conversation as any;
    const isDriver = conversation.driver_id === user.id;
    return isDriver ? enrichedConv.passenger_profile_picture : enrichedConv.driver_profile_picture;
  };
  
  const getPartnerName = () => {
    if (!conversation || !user) return 'User';
    const enrichedConv = conversation as any;
    const isDriver = conversation.driver_id === user.id;
    return isDriver ? enrichedConv.passenger_name : enrichedConv.driver_name;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const messageAnimations = useRef<Map<string, Animated.Value>>(new Map());

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
            // Avoid duplicates - check both ID and temporary ID
            const exists = prev.some(msg => 
              msg.id === newMessage.id || 
              (msg.id.startsWith('temp-') && msg.content === newMessage.content && msg.senderId === newMessage.sender_id)
            );
            
            if (exists) {
              console.log('🔄 Real-time: Replacing optimistic message with server message');
              // Replace optimistic message with real message
              return prev.map(msg => 
                (msg.id.startsWith('temp-') && msg.content === newMessage.content && msg.senderId === newMessage.sender_id)
                  ? convertMessage(newMessage, user.id)
                  : msg
              );
            }
            
            // Only add if it's from someone else (not our own message)
            if (newMessage.sender_id !== user.id) {
              return [...prev, convertMessage(newMessage, user.id)];
            }
            
            return prev;
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Add fade-in animation for new messages
      if (!messageAnimations.current.has(lastMessage.id)) {
        const animation = new Animated.Value(0);
        messageAnimations.current.set(lastMessage.id, animation);
        
        Animated.timing(animation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }

      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const fetchConversationData = async () => {
    try {
      if (__DEV__) {
        console.log('📱 MESSAGES: Fetching conversation data');
      }
      
      const conversations = await messagingApi.getConversations();
      const currentConversation = conversations.find(c => c.id === conversationId);
      
      if (currentConversation) {
        setConversation(currentConversation);
        
        // Check if messaging is disabled for this ride
        if (currentConversation.ride_id) {
          try {
            const status = await messagingApi.checkMessagingStatus(currentConversation.ride_id);
            setMessagingDisabled(status.messaging_disabled);
            setDisabledReason(status.reason || null);
            
            if (status.messaging_disabled && __DEV__) {
              console.log('🚫 MESSAGES: Messaging disabled for this conversation:', status.reason);
            }
          } catch (error) {
            if (__DEV__) {
              console.error('❌ MESSAGES: Error checking messaging status');
            }
            // Default to enabled if we can't check
            setMessagingDisabled(false);
            setDisabledReason(null);
          }
        }
      } else {
        if (__DEV__) {
          console.log('⚠️ MESSAGES: Conversation not found');
        }
        setConversation({ id: conversationId } as any);
        setMessagingDisabled(true);
        setDisabledReason('Conversation not found');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ MESSAGES: Error fetching conversation data');
      }
      setConversation({ id: conversationId } as any);
      setMessagingDisabled(true);
      setDisabledReason('Failed to load conversation');
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      console.log('📱 Fetching messages for conversation:', conversationId);
      
      const data = await messagingApi.getMessages(conversationId);
      const convertedMessages = data.map(msg => convertMessage(msg, user?.id || ''));
      setMessages(convertedMessages);
      console.log(`✅ Loaded ${data.length} messages with enriched data`);
      
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

  const handleSendMessage = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || sending || !conversation) return;

    try {
      setSending(true);
      console.log('📤 Sending message:', trimmedText);
      
      // Create optimistic message for immediate UI update
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: trimmedText,
        senderId: user?.id || '',
        timestamp: new Date(),
        isCurrentUser: true,
        status: 'sending',
        avatar: `${(user as any)?.first_name?.[0] || 'Y'}`,
        reply_to_message_id: replyingTo?.id,
        reply_to_content: replyingTo?.content,
        reply_to_sender_name: replyingTo?.isCurrentUser ? 'You' : (replyingTo?.reply_to_sender_name || 'User'),
      };

      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Clear input immediately
      setInputText('');
      setInputHeight(40);
      
      // Scroll to bottom immediately
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Send message via API (with reply if applicable)
      const response = await messagingApi.sendMessage(
        conversation.id,
        trimmedText,
        'text',
        replyingTo?.id
      );
      
      // Clear reply state after sending
      setReplyingTo(null);
      
      console.log('✅ Message sent successfully:', response);
      
      // Replace optimistic message with real message from server response
      if (response && response.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...convertMessage(response, user?.id || ''), status: 'sent' as const }
            : msg
        ));
        console.log('✅ Optimistic message replaced with server response');
      }
      
      // Focus back to input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      // Restore message text on error
      setInputText(trimmedText);
      
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [inputText, sending, conversation, user]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const handleContentSizeChange = useCallback((event: any) => {
    const { height } = event.nativeEvent.contentSize;
    const maxHeight = 120; // Max height for input container
    const minHeight = 50; // Min height for input container
    const newHeight = Math.min(Math.max(height + 20, minHeight), maxHeight);
    setInputHeight(newHeight);
  }, []);

  const handleKeyPress = useCallback((event: any) => {
    if (event.nativeEvent.key === 'Enter') {
      if (Platform.OS === 'web') {
        if (!event.nativeEvent.shiftKey) {
          event.preventDefault();
          handleSendMessage();
        }
      } else {
        // On mobile, Enter sends the message
        handleSendMessage();
      }
    }
  }, [handleSendMessage]);

  const formatTimestamp = useCallback((timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const handleMessageLongPress = useCallback((message: ChatMessage) => {
    const options: any[] = [
      { 
        text: 'Reply', 
        onPress: () => {
          setReplyingTo(message);
          inputRef.current?.focus();
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ];

    Alert.alert('Message Options', '', options);
  }, []);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isCurrentUser = item.senderId === (user?.id || '');
    const animation = messageAnimations.current.get(item.id) || new Animated.Value(1);
    
    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.userMessageContainer : styles.otherMessageContainer,
          {
            opacity: animation,
            transform: [{
              translateY: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        {/* Avatar for incoming messages */}
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            {getPartnerProfilePicture() ? (
              <Image 
                source={{ uri: getPartnerProfilePicture() }}
                style={styles.messageAvatarImage}
                onError={() => {
                  // Fallback to initials if image fails to load
                }}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(getPartnerName()) }]}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onLongPress={() => handleMessageLongPress(item)}
          activeOpacity={0.8}
          style={[
            styles.messageBubble,
            isCurrentUser 
              ? styles.userMessageBubble
              : styles.otherMessageBubble,
          ]}
        >
          {/* Reply Context - Shows the message being replied to */}
          {item.reply_to_content && (
            <View style={[
              styles.replyContext,
              isCurrentUser ? styles.replyContextUser : styles.replyContextOther
            ]}>
              <View style={[
                styles.replyLine,
                isCurrentUser ? styles.replyLineUser : styles.replyLineOther
              ]} />
              <View style={styles.replyContent}>
                <Text style={[
                  styles.replyLabel,
                  isCurrentUser ? styles.replyLabelUser : styles.replyLabelOther
                ]}>
                  Replied to {item.reply_to_sender_name || 'User'}
                </Text>
                <Text style={[
                  styles.replyText,
                  isCurrentUser ? styles.replyTextUser : styles.replyTextOther
                ]} numberOfLines={2}>
                  {item.reply_to_content}
                </Text>
              </View>
            </View>
          )}
          
          <Text
            style={[
              styles.messageText,
              isCurrentUser 
                ? styles.userMessageText
                : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {formatTimestamp(item.timestamp)}
            </Text>
            
            {isCurrentUser && item.status && (
              <Text style={styles.statusIcon}>
                {item.status === 'sending' ? '⏳' : 
                 item.status === 'sent' ? '✓' : 
                 item.status === 'delivered' ? '✓✓' : 
                 item.status === 'read' ? '✓✓' : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [user?.id, handleMessageLongPress, formatTimestamp]);

  const renderHeader = () => {
    if (!conversation || !user) return null;

    const enrichedConv = conversation as any;
    const isDriver = conversation.driver_id === user.id;
    const partner = isDriver ? {
      id: conversation.passenger_id,
      first_name: enrichedConv.passenger_name?.split(' ')[0] || 'User',
      last_name: enrichedConv.passenger_name?.split(' ').slice(1).join(' ') || '',
      profile_picture_url: enrichedConv.passenger_profile_picture,
      role: 'passenger'
    } : {
      id: conversation.driver_id,
      first_name: enrichedConv.driver_name?.split(' ')[0] || 'User',
      last_name: enrichedConv.driver_name?.split(' ').slice(1).join(' ') || '',
      profile_picture_url: enrichedConv.driver_profile_picture,
      role: 'driver'
    };

    const partnerName = `${partner.first_name} ${partner.last_name}`.trim() || 'User';

    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={styles.backButtonContainer}>
            <ArrowLeftIcon size={20} color={Colors.text} />
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.partnerAvatar}>
            {partner.profile_picture_url ? (
              <Image 
                source={{ uri: partner.profile_picture_url }}
                style={styles.avatarImage}
                onError={() => {
                  // Fallback to initials if image fails to load
                }}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(partnerName) }]}>
                <Text style={styles.avatarText}>
                  {partnerName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{partnerName}</Text>
            <Text style={styles.headerSubtitle}>
              {partner.role === 'driver' ? '🚗 Driver' : '👤 Passenger'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {conversation.ride_id && (
            <TouchableOpacity 
              style={styles.rideDetailsButton}
              onPress={() => router.push(`/ride/${conversation.ride_id}`)}
            >
              <View style={styles.rideDetailsIcon}>
                <Text style={styles.rideDetailsIconText}>i</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRideInfo = () => {
    if (!conversation?.ride) return null;

    return (
      <View style={styles.rideInfoCard}>
        <View style={styles.rideInfoContent}>
          <LocationIcon size={16} color={Colors.primary} />
          <Text style={styles.rideInfoText} numberOfLines={1}>
            {conversation.ride.departure_location} → {conversation.ride.destination_location}
          </Text>
        </View>
      </View>
    );
  };

  const renderReplyPreview = () => {
    if (!replyingTo) return null;
    
    return (
      <View style={styles.replyPreviewContainer}>
        <View style={styles.replyPreviewContent}>
          <View style={styles.replyPreviewLine} />
          <View style={styles.replyPreviewText}>
            <Text style={styles.replyPreviewAuthor}>
              Replying to {replyingTo.isCurrentUser ? 'yourself' : (replyingTo.avatar || 'User')}
            </Text>
            <Text style={styles.replyPreviewMessage} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => setReplyingTo(null)}
          style={styles.replyPreviewClose}
        >
          <Text style={styles.replyPreviewCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInputArea = () => (
    <View style={styles.inputContainer}>
      {renderReplyPreview()}
      <View style={styles.inputCenterWrapper}>
        <View style={[styles.inputWrapper, { height: Math.max(inputHeight, 50) }]}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { height: Math.max(inputHeight - 20, 30) }]}
            value={inputText}
            onChangeText={handleInputChange}
            onContentSizeChange={handleContentSizeChange}
            onKeyPress={handleKeyPress}
            placeholder={replyingTo ? "Type a reply..." : "Type a message..."}
            placeholderTextColor="#8E8E93"
            multiline
            maxLength={1000}
            editable={!sending}
            returnKeyType={Platform.OS === 'ios' ? 'default' : 'send'}
            blurOnSubmit={false}
            textAlignVertical="top"
          />
          
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sending || !inputText.trim()}
            style={[
              styles.sendButton,
              (inputText.trim() && !sending) ? styles.sendButtonActive : styles.sendButtonInactive
            ]}
          >
            <Text style={[
              styles.sendButtonText,
              (inputText.trim() && !sending) ? styles.sendButtonTextActive : styles.sendButtonTextInactive
            ]}>
              {sending ? '⏳' : '↑'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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

  // Show expired conversation UI if messaging is disabled
  if (messagingDisabled) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        
        {renderHeader()}
        
        <View style={styles.expiredContainer}>
          <View style={styles.expiredIconContainer}>
            <Text style={styles.expiredIcon}>🕐</Text>
          </View>
          <Text style={styles.expiredTitle}>Chat Expired</Text>
          <Text style={styles.expiredMessage}>
            {disabledReason || 'This conversation is no longer available. Messages are automatically deleted 45 minutes after the ride starts.'}
          </Text>
          <TouchableOpacity 
            style={styles.backToChatsButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToChatsText}>Back to Messages</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {renderHeader()}
      {renderRideInfo()}
      
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          removeClippedSubviews={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        {/* Input Area */}
        {!messagingDisabled && renderInputArea()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.33,
    borderBottomColor: '#C6C6C8',
  },
  backButton: {
    marginRight: Spacing.sm,
  },
  backButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  partnerAvatar: {
    marginRight: Spacing.md,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerInfo: {
    alignItems: 'flex-start',
    flex: 1,
  },
  headerActions: {
    width: 36,
  },
  headerName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'left',
    marginTop: 2,
  },
  rideDetailsButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  rideDetailsIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideDetailsIconText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
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
  rideInfoCard: {
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.primary + '05',
    borderColor: Colors.primary + '20',
    borderWidth: 1,
    borderRadius: 12,
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
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8, // 8px spacing between messages
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultAvatar: {
    backgroundColor: Colors.primary || '#007AFF',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75, // 75% max width
    minWidth: 60,
    paddingHorizontal: 12, // 12px padding inside bubbles
    paddingVertical: 10, // 10px padding inside bubbles
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessageBubble: {
    backgroundColor: Colors.primary || '#007AFF',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 17,
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontFamily: Platform.select({
      ios: 'SF Pro Text',
      android: 'Roboto',
      default: 'system',
    }),
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
    opacity: 0.7,
  },
  statusIcon: {
    fontSize: 12,
    marginLeft: 4,
    color: '#8E8E93',
  },
  inputContainer: {
    paddingVertical: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
  },
  inputCenterWrapper: {
    paddingHorizontal: '12.5%', // Centers input at 75% width
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 50,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'transparent',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    fontFamily: Platform.select({
      ios: 'SF Pro Text',
      android: 'Roboto',
      default: 'system',
    }),
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 0,
    lineHeight: 20,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: Colors.primary || '#007AFF',
  },
  sendButtonInactive: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonTextActive: {
    color: '#FFFFFF',
  },
  sendButtonTextInactive: {
    color: '#8E8E93',
  },
  // Reply styles - Modern WhatsApp/Telegram style
  replyContext: {
    marginBottom: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyContextUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyContextOther: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyLine: {
    width: 3,
    height: '100%',
    minHeight: 32,
    borderRadius: 1.5,
    marginRight: 8,
  },
  replyLineUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  replyLineOther: {
    backgroundColor: Colors.primary || '#007AFF',
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  replyLabelUser: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  replyLabelOther: {
    color: Colors.primary || '#007AFF',
  },
  replyText: {
    fontSize: 13,
    lineHeight: 16,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  replyTextUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  replyTextOther: {
    color: '#666666',
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary || '#007AFF',
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewLine: {
    width: 3,
    height: 40,
    backgroundColor: Colors.primary || '#007AFF',
    borderRadius: 1.5,
    marginRight: 12,
  },
  replyPreviewText: {
    flex: 1,
  },
  replyPreviewAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary || '#007AFF',
    marginBottom: 2,
  },
  replyPreviewMessage: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  replyPreviewClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E1E5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  replyPreviewCloseText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  expiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  expiredIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  expiredIcon: {
    fontSize: 40,
  },
  expiredTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  expiredMessage: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  backToChatsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  backToChatsText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
