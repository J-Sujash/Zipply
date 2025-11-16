import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from './Button';
import { XIcon, MessageIcon, UserIcon } from './Icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RequestMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onSendRequest: (message: string) => void;
  driverName: string;
  rideTitle: string;
  pricePerSeat: number;
  loading?: boolean;
}

export function RequestMessageModal({
  visible,
  onClose,
  onSendRequest,
  driverName,
  rideTitle,
  pricePerSeat,
  loading = false,
}: RequestMessageModalProps) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset message when modal opens
      setMessage('');
    }
  }, [visible]);

  const handleSendRequest = () => {
    onSendRequest(message.trim());
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity 
            style={styles.backdropTouchable}
            activeOpacity={1} 
            onPress={handleClose}
          />
          
          <View style={styles.modalContainer}>
            <View style={styles.modal}>
              <ScrollView 
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
              {/* Modern Header */}
              <View style={styles.header}>
                <View style={styles.headerContent}>
                  <View style={styles.headerIcon}>
                    <MessageIcon size={24} color={Colors.white} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Join Ride</Text>
                    <Text style={styles.headerSubtitle}>Send request to driver</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <XIcon size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Ride Details Card */}
              <View style={styles.rideCard}>
                <View style={styles.rideHeader}>
                  <Text style={styles.rideTitle}>{rideTitle}</Text>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>${pricePerSeat}</Text>
                  </View>
                </View>
                
                <View style={styles.driverSection}>
                  <View style={styles.driverIcon}>
                    <UserIcon size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <Text style={styles.driverLabel}>Driver</Text>
                </View>
              </View>

              {/* Message Section */}
              <View style={styles.messageSection}>
                <Text style={styles.messageLabel}>
                  Message (Optional)
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder={`Hi ${driverName}, I'd like to join your ride!`}
                    placeholderTextColor={Colors.textSecondary}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                    textAlignVertical="top"
                    blurOnSubmit={false}
                    returnKeyType="default"
                  />
                  <Text style={styles.characterCount}>
                    {message.length}/200
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                  onPress={handleSendRequest}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <Text style={styles.sendButtonText}>Sending...</Text>
                  ) : (
                    <>
                      <Text style={styles.sendButtonText}>Send Request</Text>
                      <MessageIcon size={16} color={Colors.white} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: screenWidth * 0.92,
    maxWidth: 420,
    maxHeight: screenHeight * 0.85,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    zIndex: 1000,
    elevation: 1000,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
    maxHeight: screenHeight * 0.85,
    overflow: 'hidden',
  },
  modalScroll: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  rideCard: {
    margin: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border + '30',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rideTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 12,
  },
  priceTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 8,
  },
  driverLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    backgroundColor: Colors.border + '40',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '500',
  },
  messageSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  inputContainer: {
    position: 'relative',
  },
  messageInput: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    fontWeight: '400',
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sendButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
