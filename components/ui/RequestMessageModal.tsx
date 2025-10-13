import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from './Button';
import { XIcon, MessageIcon } from './Icons';

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

  const handleSendRequest = () => {
    onSendRequest(message.trim());
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleClose}
        >
          <TouchableOpacity 
            style={styles.modal} 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <MessageIcon size={20} color={Colors.primary} />
                </View>
                <Text style={styles.headerTitle}>Request to Join</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleClose}
              >
                <XIcon size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Ride Info */}
            <View style={styles.rideInfo}>
              <Text style={styles.rideTitle}>{rideTitle}</Text>
              <Text style={styles.driverInfo}>
                Driver: {driverName} • ${pricePerSeat} per seat
              </Text>
            </View>

            {/* Message Section */}
            <View style={styles.messageSection}>
              <Text style={styles.messageLabel}>
                Send an optional message to {driverName}
              </Text>
              <TextInput
                style={styles.messageInput}
                placeholder={`Hi ${driverName}, I'd like to join your ride!`}
                placeholderTextColor={Colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {message.length}/200 characters
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Button
                title="Cancel"
                onPress={handleClose}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title="Send Request"
                onPress={handleSendRequest}
                loading={loading}
                style={styles.sendButton}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideInfo: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rideTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  driverInfo: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  messageSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  messageLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 100,
    maxHeight: 120,
  },
  characterCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  sendButton: {
    flex: 1,
  },
});
