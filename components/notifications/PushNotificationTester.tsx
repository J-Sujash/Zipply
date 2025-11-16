/**
 * Push Notification Tester Component
 * For testing push notifications during development
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button } from '../ui/Button';
import { sendTestNotification } from '../../lib/pushNotifications';
import { Colors, Spacing } from '../../constants/Colors';

export const PushNotificationTester: React.FC = () => {
  const handleSendTestNotification = async () => {
    try {
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
      console.error('Test notification error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title="Send Test Notification 🔔"
        onPress={handleSendTestNotification}
        variant="outline"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    margin: Spacing.md,
  },
});
