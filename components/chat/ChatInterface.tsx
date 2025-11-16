import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/Colors';

// Types
export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isCurrentUser: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  avatar?: string;
}

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
  onMessageLongPress?: (message: ChatMessage) => void;
  placeholder?: string;
  maxInputLines?: number;
  showAvatars?: boolean;
  showMessageStatus?: boolean;
  containerStyle?: any;
  theme?: 'light' | 'dark';
}

const { width: screenWidth } = Dimensions.get('window');

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onMessageLongPress,
  placeholder = "Type a message...",
  maxInputLines = 4,
  showAvatars = false,
  showMessageStatus = false,
  containerStyle,
  theme = 'light',
}) => {
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [sending, setSending] = useState(false);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const messageAnimations = useRef<Map<string, Animated.Value>>(new Map());

  // Theme colors
  const themeColors = {
    light: {
      background: '#FFFFFF',
      messageBackground: '#F5F5F5',
      userMessageBackground: Colors.primary || '#007AFF',
      messageText: '#000000',
      userMessageText: '#FFFFFF',
      inputBackground: '#F8F9FA',
      inputBorder: '#E1E5E9',
      timestamp: '#8E8E93',
      placeholder: '#8E8E93',
    },
    dark: {
      background: '#1C1C1E',
      messageBackground: '#2C2C2E',
      userMessageBackground: Colors.primary || '#0A84FF',
      messageText: '#FFFFFF',
      userMessageText: '#FFFFFF',
      inputBackground: '#2C2C2E',
      inputBorder: '#38383A',
      timestamp: '#8E8E93',
      placeholder: '#8E8E93',
    },
  };

  const colors = themeColors[theme];

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

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || sending) return;

    try {
      setSending(true);
      setInputText('');
      setInputHeight(40);
      
      await onSendMessage(trimmedText);
      
      // Focus back to input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Restore message text on error
      setInputText(trimmedText);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, onSendMessage]);

  // Handle input text changes
  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
  }, []);

  // Handle input height changes for multi-line support
  const handleContentSizeChange = useCallback((event: any) => {
    const { height } = event.nativeEvent.contentSize;
    const maxHeight = 40 + (maxInputLines - 1) * 20;
    const newHeight = Math.min(Math.max(height, 40), maxHeight);
    setInputHeight(newHeight);
  }, [maxInputLines]);

  // Handle key press for Enter/Shift+Enter
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

  // Format timestamp
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

  // Get message status icon
  const getStatusIcon = useCallback((status?: string) => {
    switch (status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  }, []);

  // Render individual message
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isCurrentUser = item.senderId === currentUserId;
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
        {!isCurrentUser && showAvatars && (
          <View style={styles.avatarContainer}>
            {item.avatar ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.avatar}
                </Text>
              </View>
            ) : (
              <View style={[styles.avatar, styles.defaultAvatar]}>
                <Text style={styles.avatarText}>U</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onLongPress={() => onMessageLongPress?.(item)}
          activeOpacity={0.8}
          style={[
            styles.messageBubble,
            isCurrentUser 
              ? [styles.userMessageBubble, { backgroundColor: colors.userMessageBackground }]
              : [styles.otherMessageBubble, { backgroundColor: colors.messageBackground }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isCurrentUser 
                ? [styles.userMessageText, { color: colors.userMessageText }]
                : [styles.otherMessageText, { color: colors.messageText }],
            ]}
          >
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[styles.timestamp, { color: colors.timestamp }]}>
              {formatTimestamp(item.timestamp)}
            </Text>
            
            {isCurrentUser && showMessageStatus && (
              <Text style={[styles.statusIcon, { color: colors.timestamp }]}>
                {getStatusIcon(item.status)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [currentUserId, showAvatars, showMessageStatus, onMessageLongPress, formatTimestamp, getStatusIcon, colors]);

  // Render input area
  const renderInputArea = () => (
    <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
      <View style={[
        styles.inputWrapper,
        { 
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
          minHeight: inputHeight,
        }
      ]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            { 
              height: inputHeight,
              color: colors.messageText,
            }
          ]}
          value={inputText}
          onChangeText={handleInputChange}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={1000}
          editable={!sending}
          returnKeyType={Platform.OS === 'ios' ? 'default' : 'send'}
          blurOnSubmit={false}
        />
        
        {(inputText.trim() || sending) && (
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sending || !inputText.trim()}
            style={[
              styles.sendButton,
              { 
                backgroundColor: colors.userMessageBackground,
                opacity: (sending || !inputText.trim()) ? 0.5 : 1,
              }
            ]}
          >
            <Text style={styles.sendButtonText}>
              {sending ? '⏳' : '↑'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }, containerStyle]}
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
        getItemLayout={(data, index) => ({
          length: 80, // Approximate message height
          offset: 80 * index,
          index,
        })}
      />

      {/* New Message Indicator */}
      {showNewMessageIndicator && (
        <TouchableOpacity
          style={styles.newMessageIndicator}
          onPress={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowNewMessageIndicator(false);
          }}
        >
          <Text style={styles.newMessageText}>New messages ↓</Text>
        </TouchableOpacity>
      )}

      {/* Input Area */}
      {renderInputArea()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
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
  defaultAvatar: {
    backgroundColor: Colors.primary || '#007AFF',
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    minWidth: 60,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
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
    borderBottomRightRadius: BorderRadius.sm,
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    borderBottomLeftRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.4,
    fontFamily: Platform.select({
      ios: 'SF Pro Text',
      android: 'Roboto',
      default: 'system',
    }),
  },
  userMessageText: {
    fontWeight: '400',
  },
  otherMessageText: {
    fontWeight: '400',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  timestamp: {
    fontSize: FontSize.xs,
    fontWeight: '400',
    opacity: 0.7,
  },
  statusIcon: {
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs,
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Platform.select({
      ios: 'SF Pro Text',
      android: 'Roboto',
      default: 'system',
    }),
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  newMessageIndicator: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: Colors.primary || '#007AFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  newMessageText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});

export default ChatInterface;
