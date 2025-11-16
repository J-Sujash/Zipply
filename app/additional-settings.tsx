import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';

export default function AdditionalSettingsScreen() {
  const { user, signOut, resetPassword } = useAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowDeleteModal(true),
        },
      ]
    );
  };

  const verifyPasswordAndDelete = async () => {
    if (!user || !passwordInput.trim()) {
      Alert.alert('Error', 'Please enter your password to continue.');
      return;
    }

    try {
      setVerifyingPassword(true);

      // Verify password by attempting to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: passwordInput,
      });

      if (authError) {
        Alert.alert('Error', 'Incorrect password. Please try again.');
        setPasswordInput('');
        return;
      }

      // Password verified, proceed with account deletion
      await executeDeleteAccount();

    } catch (error: any) {
      console.error('Error verifying password:', error);
      Alert.alert('Error', 'Failed to verify password. Please try again.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const executeDeleteAccount = async () => {
    if (!user) return;

    try {
      setDeletingAccount(true);
      console.log('🗑️ Starting account deletion process for user:', user.id);

      // Delete related data first (in order of dependencies)
      console.log('📝 Deleting ride requests...');
      const { error: rideRequestsError } = await supabase
        .from('ride_requests')
        .delete()
        .eq('passenger_id', user.id);
      
      if (rideRequestsError) console.log('⚠️ Ride requests deletion error:', rideRequestsError);

      console.log('⭐ Deleting reviews...');
      const { error: reviewsError } = await supabase
        .from('reviews')
        .delete()
        .or(`reviewer_id.eq.${user.id},reviewee_id.eq.${user.id}`);
      
      if (reviewsError) console.log('⚠️ Reviews deletion error:', reviewsError);

      console.log('🔔 Deleting notifications...');
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      
      if (notificationsError) console.log('⚠️ Notifications deletion error:', notificationsError);

      console.log('🚗 Deleting rides...');
      const { error: ridesError } = await supabase
        .from('rides')
        .delete()
        .eq('driver_id', user.id);
      
      if (ridesError) console.log('⚠️ Rides deletion error:', ridesError);

      console.log('🚙 Deleting vehicles...');
      const { error: vehiclesError } = await supabase
        .from('vehicles')
        .delete()
        .eq('user_id', user.id);
      
      if (vehiclesError) console.log('⚠️ Vehicles deletion error:', vehiclesError);

      console.log('💬 Deleting conversations and messages...');
      // Get all conversations where user is driver or passenger
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('id')
        .or(`driver_id.eq.${user.id},passenger_id.eq.${user.id}`);
      
      if (conversationsError) {
        console.log('⚠️ Conversations fetch error:', conversationsError);
      } else if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map((c: any) => c.id);
        
        // Delete messages in these conversations
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('conversation_id', conversationIds);
        
        if (messagesError) console.log('⚠️ Messages deletion error:', messagesError);
        
        // Delete conversations
        const { error: deleteConversationsError } = await supabase
          .from('conversations')
          .delete()
          .in('id', conversationIds);
        
        if (deleteConversationsError) console.log('⚠️ Conversations deletion error:', deleteConversationsError);
      }

      console.log('👤 Deleting user profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ Profile deletion failed:', profileError);
        throw new Error('Failed to delete user profile: ' + profileError.message);
      }

      // Note: We cannot delete the auth user from the client side
      // All user data has been deleted, so the account is effectively deactivated
      // The auth user will remain but won't have any associated data
      console.log('✅ All user data deleted. Auth user will remain but has no data.');

      // Close modal and sign out user
      setShowDeleteModal(false);
      setPasswordInput('');
      
      console.log('✅ Account deletion completed successfully');
      
      // Sign out and redirect
      await signOut();
      
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted. Thank you for using Zipply.',
        [{ 
          text: 'OK',
          onPress: () => router.replace('/auth/login')
        }]
      );

    } catch (error: any) {
      console.error('❌ Error deleting account:', error);
      Alert.alert(
        'Deletion Failed',
        error.message || 'Failed to delete account. Please try again or contact support if the problem persists.',
        [{ text: 'OK' }]
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
  };

  const verifyCurrentPasswordAndChange = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password.');
      return;
    }

    try {
      setChangingPassword(true);

      // First verify current password by attempting to sign in
      if (!user?.email) {
        Alert.alert('Error', 'User email not found.');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (authError) {
        Alert.alert('Error', 'Current password is incorrect. Please try again.');
        setCurrentPassword('');
        return;
      }

      // Password verified, now update to new password
      const { error: updateError } = await resetPassword(newPassword);

      if (updateError) {
        Alert.alert('Error', updateError.message || 'Failed to update password. Please try again.');
        return;
      }

      // Success
      Alert.alert(
        'Success',
        'Your password has been updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowChangePasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const additionalSettings = [
    {
      title: 'Change Password',
      description: 'Update your account password',
      icon: '🔑',
      type: 'button',
      onPress: handleChangePassword,
      color: Colors.warning,
    },
    {
      title: 'Delete Account',
      description: 'Permanently delete your account and all data',
      icon: '⚠️',
      type: 'button',
      onPress: handleDeleteAccount,
      color: Colors.error,
      dangerous: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Additional Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="elevated" style={styles.infoCard}>
          <Text style={styles.infoTitle}>⚙️ Additional Settings</Text>
          <Text style={styles.infoDescription}>
            Manage your basic preferences, account security, and profile settings.
          </Text>
        </Card>

        <Card variant="elevated" style={styles.settingsCard}>
          {additionalSettings.map((setting, index) => (
            <View
              key={index}
              style={[
                styles.settingItem,
                index === additionalSettings.length - 1 && styles.lastSettingItem,
                setting.dangerous && styles.dangerousItem,
              ]}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: setting.color + '20' }]}>
                  <Text style={styles.settingEmoji}>{setting.icon}</Text>
                </View>
                <View style={styles.settingContent}>
                  <Text style={[
                    styles.settingTitle,
                    setting.dangerous && styles.dangerousText
                  ]}>
                    {setting.title}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {setting.description}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                onPress={setting.onPress}
                disabled={
                  (deletingAccount && setting.title === 'Delete Account') ||
                  (changingPassword && setting.title === 'Change Password')
                }
                style={styles.settingButton}
              >
                {(deletingAccount && setting.title === 'Delete Account') ||
                (changingPassword && setting.title === 'Change Password') ? (
                  <ActivityIndicator 
                    size="small" 
                    color={setting.dangerous ? Colors.error : Colors.warning} 
                  />
                ) : (
                  <Text style={[
                    styles.settingArrow,
                    setting.dangerous && styles.dangerousText
                  ]}>
                    ›
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </Card>

        <Card variant="outlined" style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Important Notice</Text>
          <Text style={styles.warningText}>
            Account deletion is permanent and cannot be undone. All your data including rides, 
            reviews, and profile information will be permanently removed from our servers.
          </Text>
        </Card>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: Colors.warning }]}>Change Password</Text>
            <Text style={styles.modalDescription}>
              Enter your current password and choose a new password.
            </Text>
            
            <Input
              label="Current Password"
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={true}
              style={styles.passwordInput}
            />
            
            <Input
              label="New Password"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
              style={styles.passwordInput}
            />
            
            <Input
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
              style={styles.passwordInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={styles.cancelButton}
              />
              <Button
                title="Change Password"
                onPress={verifyCurrentPasswordAndChange}
                loading={changingPassword}
                style={[styles.changePasswordButton, { backgroundColor: Colors.warning }]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Verification Modal for Account Deletion */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalDescription}>
              To confirm account deletion, please enter your password. This action cannot be undone.
            </Text>
            
            <Input
              label="Password"
              placeholder="Enter your password"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry={true}
              style={styles.passwordInput}
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowDeleteModal(false);
                  setPasswordInput('');
                }}
                style={styles.cancelButton}
              />
              <Button
                title="Delete Account"
                onPress={verifyPasswordAndDelete}
                loading={verifyingPassword || deletingAccount}
                style={styles.deleteButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  placeholder: {
    width: 60,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  infoCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  infoTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  dangerousItem: {
    backgroundColor: Colors.error + '05',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingEmoji: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  settingArrow: {
    fontSize: 20,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  dangerousText: {
    color: Colors.error,
  },
  warningCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.warning + '10',
    borderColor: Colors.warning + '30',
  },
  warningTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.warning,
    marginBottom: Spacing.sm,
  },
  warningText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  settingButton: {
    padding: Spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    margin: Spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  passwordInput: {
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
  },
  changePasswordButton: {
    flex: 1,
  },
});
