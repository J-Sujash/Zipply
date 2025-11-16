import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToConversationMessages,
  markMessagesAsRead,
  type Message,
  type Conversation,
} from '../../lib/messagingService';
import { messagingApi } from '../../lib/apiClient';
import ChatInterface, { ChatMessage } from './ChatInterface';
import { ArrowLeftIcon, LocationIcon } from '../ui/Icons';
import { Colors, FontSize, Spacing } from '../../constants/Colors';

// Convert Message to ChatMessage format
const convertMessage = (message: Message, currentUserId: string): ChatMessage => ({
  id: message.id,
  content: message.content,
  senderId: message.sender_id,
  timestamp: new Date(message.created_at),
  isCurrentUser: message.sender_id === currentUserId,
  status: message.sender_id === currentUserId ? 'read' : undefined,
  avatar: (message as any).sender_name?.[0]?.toUpperCase() || 'U',
});

export default function ModernChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fetchConversationData = async () => {
    try {
      console.log('📱 Fetching conversation data for:', conversationId);
      
      const conversations = await messagingApi.getConversations();
      const currentConversation = conversations.find(c => c.id === conversationId);
      
      if (currentConversation) {
        console.log('✅ Found conversation with enriched data:', currentConversation);
        setConversation(currentConversation);
      } else {
        console.log('⚠️ Conversation not found, creating minimal data');
        setConversation({ id: conversationId } as any);
      }
    } catch (error) {
      console.error('❌ Error fetching conversation data:', error);
      setConversation({ id: conversationId } as any);
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

  const handleSendMessage = useCallback(async (content: string) => {
    if (!conversation || !user) return;

    try {
      console.log('📤 Sending message:', content);
      
      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        senderId: user.id,
        timestamp: new Date(),
        isCurrentUser: true,
        status: 'sending',
        avatar: `${(user as any)?.first_name?.[0] || 'Y'}`,
      };

      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Send message via API
      const response = await messagingApi.sendMessage(
        conversation.id,
        content,
        'text'
      );
      
      console.log('✅ Message sent successfully:', response);
      
      // Replace optimistic message with real message from server response
      if (response && response.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...convertMessage(response, user.id), status: 'sent' }
            : msg
        ));
        console.log('✅ Optimistic message replaced with server response');
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      throw error; // Let ChatInterface handle the error display
    }
  }, [conversation, user]);

  const handleMessageLongPress = useCallback((message: ChatMessage) => {
    const options: any[] = [
      { text: 'Copy', onPress: () => console.log('Copy message:', message.content) },
    ];

    if (message.isCurrentUser) {
      options.push({ 
        text: 'Delete', 
        onPress: () => console.log('Delete message:', message.id),
        style: 'destructive'
      });
    }

    options.push(
      { text: 'React', onPress: () => console.log('React to message:', message.id) },
      { text: 'Cancel', style: 'cancel' }
    );

    Alert.alert('Message Options', '', options);
  }, []);

  const renderHeader = () => {
    if (!conversation || !user) return null;

    const enrichedConv = conversation as any;
    const isDriver = conversation.driver_id === user.id;
    const partner = isDriver ? {
      id: conversation.passenger_id,
      first_name: enrichedConv.passenger_name?.split(' ')[0] || 'User',
      last_name: enrichedConv.passenger_name?.split(' ').slice(1).join(' ') || '',
      role: 'passenger'
    } : {
      id: conversation.driver_id,
      first_name: enrichedConv.driver_name?.split(' ')[0] || 'User',
      last_name: enrichedConv.driver_name?.split(' ').slice(1).join(' ') || '',
      role: 'driver'
    };

    const partnerName = `${partner.first_name} ${partner.last_name}`.trim() || 'User';

    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeftIcon size={24} color={Colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{partnerName}</Text>
            <Text style={styles.headerSubtitle}>
              {partner.role === 'driver' ? 'Driver' : 'Passenger'}
            </Text>
          </View>
        </View>

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {renderHeader()}
      {renderRideInfo()}
      
      <ChatInterface
        messages={messages}
        currentUserId={user?.id || ''}
        onSendMessage={handleSendMessage}
        onMessageLongPress={handleMessageLongPress}
        placeholder="Type a message..."
        maxInputLines={4}
        showAvatars={true}
        showMessageStatus={true}
        theme="light"
        containerStyle={styles.chatContainer}
      />
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
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerInfo: {
    alignItems: 'flex-start',
    flex: 1,
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
});
