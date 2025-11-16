import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import ChatInterface, { ChatMessage } from './ChatInterface';

// Demo component showing how to use the ChatInterface
export const ChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: 'Hey! How are you doing?',
      senderId: 'other-user',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      isCurrentUser: false,
      status: 'read',
      avatar: 'J',
    },
    {
      id: '2',
      content: 'I\'m doing great! Just working on this new chat interface. What do you think of the design?',
      senderId: 'current-user',
      timestamp: new Date(Date.now() - 240000), // 4 minutes ago
      isCurrentUser: true,
      status: 'read',
    },
    {
      id: '3',
      content: 'It looks amazing! I love the clean design and the smooth animations. The message bubbles look just like iMessage.',
      senderId: 'other-user',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      isCurrentUser: false,
      status: 'read',
      avatar: 'J',
    },
    {
      id: '4',
      content: 'Thanks! I tried to make it as modern and accessible as possible. It supports multi-line messages, proper keyboard handling, and even has message status indicators.',
      senderId: 'current-user',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      isCurrentUser: true,
      status: 'delivered',
    },
    {
      id: '5',
      content: 'That\'s awesome! Can you show me how the long messages wrap? I want to see how it handles really long text that spans multiple lines and tests the 75% width constraint.',
      senderId: 'other-user',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
      isCurrentUser: false,
      status: 'read',
      avatar: 'J',
    },
  ]);

  const currentUserId = 'current-user';

  // Handle sending new messages
  const handleSendMessage = useCallback(async (content: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      senderId: currentUserId,
      timestamp: new Date(),
      isCurrentUser: true,
      status: 'sending',
    };

    setMessages(prev => [...prev, newMessage]);

    // Simulate message status updates
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, status: 'sent' as const }
          : msg
      ));
    }, 1000);

    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, status: 'delivered' as const }
          : msg
      ));
    }, 2000);

    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, status: 'read' as const }
          : msg
      ));
    }, 3000);
  }, [currentUserId]);

  // Handle message long press
  const handleMessageLongPress = useCallback((message: ChatMessage) => {
    Alert.alert(
      'Message Options',
      `Message: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`,
      [
        { text: 'Copy', onPress: () => console.log('Copy message:', message.content) },
        { text: 'Delete', onPress: () => console.log('Delete message:', message.id), style: 'destructive' },
        { text: 'React', onPress: () => console.log('React to message:', message.id) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ChatInterface
        messages={messages}
        currentUserId={currentUserId}
        onSendMessage={handleSendMessage}
        onMessageLongPress={handleMessageLongPress}
        placeholder="Type your message..."
        maxInputLines={4}
        showAvatars={true}
        showMessageStatus={true}
        theme="light"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default ChatDemo;
