import { ApiConversation, ApiMessage, messagingApi } from './apiClient';
import { supabase } from './supabase';

// Re-export types for compatibility
export type Conversation = ApiConversation;
export type Message = ApiMessage;

/**
 * MESSAGING SERVICE - CONNECTED TO APPLICATION SERVER
 * 
 * This service routes all messaging operations through the application server
 * while maintaining real-time functionality via Supabase subscriptions.
 * 
 * Flow: Frontend -> Application Server -> Database
 * Real-time: Database -> Supabase Realtime -> Frontend
 */

/**
 * Get all conversations for the current user via application server
 */
export async function getUserConversations(): Promise<Conversation[]> {
  try {
    console.log('📱 Fetching conversations via application server...');
    const conversations = await messagingApi.getConversations();
    console.log(`✅ Loaded ${conversations.length} conversations from server`);
    return conversations;
  } catch (error) {
    console.error('❌ Error fetching conversations from server:', error);
    throw error;
  }
}

/**
 * Get messages for a specific conversation via application server
 */
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  try {
    console.log(`📱 Fetching messages for conversation ${conversationId} via application server...`);
    const messages = await messagingApi.getConversationMessages(conversationId);
    console.log(`✅ Loaded ${messages.length} messages from server`);
    return messages;
  } catch (error) {
    console.error('❌ Error fetching messages from server:', error);
    throw error;
  }
}

/**
 * Send a message via application server with real-time delivery
 * Server inserts into Supabase → Real-time subscribers get instant updates
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  messageType: 'text' | 'system' | 'location' = 'text'
): Promise<Message> {
  try {
    console.log(`🚀 Sending real-time message via application server: ${conversationId}`);
    
    // Send via your application server (which will insert into Supabase for real-time)
    const message = await messagingApi.sendMessage(conversationId, content, messageType);
    
    console.log('✅ Real-time message sent via application server');
    return message;
  } catch (error) {
    console.error('❌ Error sending real-time message via server:', error);
    throw error;
  }
}

/**
 * Mark messages as read via application server with real-time updates
 * Server updates Supabase → Real-time subscribers get instant updates
 */
export async function markMessagesAsRead(conversationId: string): Promise<void> {
  try {
    console.log(`📖 Marking messages as read via application server (real-time): ${conversationId}`);
    
    // Send via your application server (which will update Supabase for real-time)
    await messagingApi.markMessagesAsRead(conversationId);
    
    console.log('✅ Messages marked as read via application server (real-time)');
  } catch (error) {
    console.error('❌ Error marking messages as read via server:', error);
    throw error;
  }
}

/**
 * Get or create a conversation between driver and passenger for a ride via application server
 */
export async function getOrCreateConversation(
  rideId: string,
  driverId: string,
  passengerId: string
): Promise<string> {
  try {
    console.log(`🔄 Getting or creating conversation for ride ${rideId} via application server...`);
    const result = await messagingApi.getOrCreateConversation({
      ride_id: rideId,
      driver_id: driverId,
      passenger_id: passengerId,
    });
    console.log(`✅ Conversation ready: ${result.conversation_id}`);
    return result.conversation_id;
  } catch (error) {
    console.error('❌ Error getting/creating conversation via server:', error);
    throw error;
  }
}

/**
 * Get total unread message count for current user via application server
 */
export async function getUnreadMessageCount(): Promise<number> {
  try {
    console.log('📱 Fetching unread message count via application server...');
    const result = await messagingApi.getUnreadMessageCount();
    console.log(`✅ Unread count from server: ${result.count}`);
    return result.count;
  } catch (error) {
    console.error('❌ Error getting unread count from server:', error);
    return 0;
  }
}

/**
 * Check if messaging is disabled for a specific ride (45+ minutes after start)
 */
export async function isMessagingDisabled(rideId: string): Promise<{
  disabled: boolean;
  reason?: string;
}> {
  try {
    console.log(`🔍 Checking messaging status for ride: ${rideId}`);
    const result = await messagingApi.checkMessagingStatus(rideId);
    console.log(`✅ Messaging status: disabled=${result.messaging_disabled}, reason=${result.reason}`);
    
    return {
      disabled: result.messaging_disabled,
      reason: result.reason,
    };
  } catch (error) {
    console.error('❌ Error checking messaging status:', error);
    // Default to disabled on error for safety
    return {
      disabled: true,
      reason: 'Error checking messaging status',
    };
  }
}

// ============================================================================
// REAL-TIME FUNCTIONALITY (Still uses Supabase for instant updates)
// ============================================================================

/**
 * Subscribe to new messages in a conversation
 * Note: Real-time still uses Supabase for instant updates
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: Message) => void
) {
  console.log(`🔔 Setting up real-time subscription for conversation: ${conversationId}`);
  
  return supabase
    .channel(`conversation-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('💬 Real-time: New message received', payload.new);
        
        // Fetch the complete message with sender info and reply context via Supabase
        // (Real-time data doesn't include joined tables or reply context)
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey (
              id,
              first_name,
              last_name,
              profile_picture_url
            ),
            reply_message:messages!messages_reply_to_message_id_fkey (
              id,
              content,
              sender:profiles!messages_sender_id_fkey (
                first_name,
                last_name
              )
            )
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data as Message);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to conversation updates (for real-time conversation list)
 * Note: Real-time still uses Supabase for instant updates
 */
export function subscribeToUserConversations(
  userId: string,
  onUpdate: () => void
) {
  console.log(`🔔 Setting up real-time subscription for user conversations: ${userId}`);
  
  return supabase
    .channel(`user-conversations-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `driver_id=eq.${userId}`,
      },
      () => {
        console.log('🔄 Real-time: Conversation updated (as driver)');
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `passenger_id=eq.${userId}`,
      },
      () => {
        console.log('🔄 Real-time: Conversation updated (as passenger)');
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        console.log('💬 Real-time: Message event received', payload.eventType);
        onUpdate();
      }
    )
    .subscribe();
}

/**
 * Subscribe to message read status updates
 * Note: Real-time still uses Supabase for instant updates
 */
export function subscribeToMessageUpdates(
  userId: string,
  onUpdate: () => void
) {
  console.log(`🔔 Setting up real-time subscription for message updates: ${userId}`);
  
  return supabase
    .channel(`message-updates-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        console.log('📖 Real-time: Message read status updated');
        onUpdate();
      }
    )
    .subscribe();
}

// ============================================================================
// UTILITY FUNCTIONS (No changes needed)
// ============================================================================

/**
 * Format time for message display
 */
export function formatMessageTime(timestamp: string): string {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  
  // For older messages, show date
  return messageTime.toLocaleDateString();
}

/**
 * Get conversation partner info (the other person in the conversation)
 */
export function getConversationPartner(conversation: Conversation, currentUserId: string) {
  if (conversation.driver_id === currentUserId) {
    return {
      ...conversation.passenger,
      role: 'passenger' as const,
    };
  } else {
    return {
      ...conversation.driver,
      role: 'driver' as const,
    };
  }
}
