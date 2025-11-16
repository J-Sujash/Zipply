import { supabase } from './supabase';
// TODO: Replace all direct Supabase calls with API client calls to go through application server
// For now, keeping Supabase calls for messaging as they require real-time functionality

export interface Conversation {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  // Joined data
  ride?: {
    departure_location: string;
    destination_location: string;
    departure_time: string;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  passenger?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
    message_type: string;
  };
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system' | 'location';
  is_read: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
}

/**
 * Get all conversations for the current user
 */
export async function getUserConversations(): Promise<Conversation[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        ride:rides!conversations_ride_id_fkey (
          departure_location,
          destination_location,
          departure_time
        ),
        driver:profiles!conversations_driver_id_fkey (
          id,
          first_name,
          last_name,
          profile_picture_url
        ),
        passenger:profiles!conversations_passenger_id_fkey (
          id,
          first_name,
          last_name,
          profile_picture_url
        )
      `)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // Get last message and unread count for each conversation
    const conversationsWithDetails = await Promise.all(
      (data || []).map(async (conversation) => {
        // Get last message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, sender_id, created_at, message_type')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversation.id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        return {
          ...conversation,
          last_message: lastMessage,
          unread_count: unreadCount || 0,
        };
      })
    );

    return conversationsWithDetails;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          id,
          first_name,
          last_name,
          profile_picture_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  messageType: 'text' | 'system' | 'location' = 'text'
): Promise<Message> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log(`💬 Sending message to conversation: ${conversationId}`);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: messageType,
        is_read: false,
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          id,
          first_name,
          last_name,
          profile_picture_url
        )
      `)
      .single();

    if (error) throw error;
    
    // Update conversation's last_message_at timestamp
    await supabase
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Mark messages as read in a conversation
 */
export async function markMessagesAsRead(conversationId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log(`📖 Marking messages as read for conversation: ${conversationId}`);
    
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    
    // Also update conversation's last_message_at to trigger real-time updates
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
      
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
}

/**
 * Get or create a conversation between driver and passenger for a ride
 */
export async function getOrCreateConversation(
  rideId: string,
  driverId: string,
  passengerId: string
): Promise<string> {
  try {
    // First try to find existing conversation
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('id')
      .eq('ride_id', rideId)
      .eq('driver_id', driverId)
      .eq('passenger_id', passengerId)
      .single();

    if (existing && !findError) {
      return existing.id;
    }

    // Create new conversation if it doesn't exist
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        ride_id: rideId,
        driver_id: driverId,
        passenger_id: passengerId,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    throw error;
  }
}

/**
 * Get total unread message count for current user
 */
export async function getUnreadMessageCount(): Promise<number> {
  try {
    // Import messagingApi here to avoid circular imports
    const { messagingApi } = await import('./apiClient');
    
    if (__DEV__) {
      console.log('📊 Getting unread message count from server...');
    }
    const response = await messagingApi.getUnreadMessageCount();
    
    return response.count || 0;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Error getting unread message count from server:', error);
    }
    
    // Fallback to direct Supabase call if server is unavailable
    try {
      if (__DEV__) {
        console.log('🔄 Falling back to direct Supabase call...');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase.rpc('get_unread_message_count', {
        user_id: user.id
      });

      if (error) throw error;
      return data || 0;
    } catch (fallbackError) {
      if (__DEV__) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
      return 0;
    }
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: Message) => void
) {
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
        // Fetch the complete message with sender info
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey (
              id,
              first_name,
              last_name,
              profile_picture_url
            )
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to conversation updates (for real-time conversation list)
 */
export function subscribeToUserConversations(
  userId: string,
  onUpdate: () => void
) {
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
        console.log('💬 Real-time: New message received', payload.new);
        onUpdate();
      }
    )
    .subscribe();
}

/**
 * Subscribe to message read status updates
 */
export function subscribeToMessageUpdates(
  userId: string,
  onUpdate: () => void
) {
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
        console.log('📖 Real-time: Message read status updated', payload.new);
        onUpdate();
      }
    )
    .subscribe();
}

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
