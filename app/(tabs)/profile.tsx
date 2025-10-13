import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
  Linking,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { pickImage, takePhoto, updateCompleteProfilePicture } from '../../lib/imageUpload';
import { getUnreadMessageCount } from '../../lib/messaging';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  UserIcon,
  MailIcon,
  CarIcon,
  CheckIcon,
} from '../../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { NotificationIcon } from '../../components/ui/NotificationIcon';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  university: string;
  phone: string;
  bio: string;
  totalRides: number;
  rating: number;
  verified: boolean;
  gradYear?: number;
  degree?: string;
  dateOfBirth?: string;
  profilePictureUrl?: string;
}

export default function ProfileScreen() {
  const { user, profile: authProfile, signOut, updateProfile, refreshProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (authProfile) {
      setProfile({
        firstName: authProfile.first_name || '',
        lastName: authProfile.last_name || '',
        email: authProfile.school_email || '',
        university: authProfile.school || '',
        phone: authProfile.phone_number || '',
        bio: authProfile.description || '',
        totalRides: authProfile.total_rides_as_driver + authProfile.total_rides_as_passenger,
        rating: authProfile.rating || 0,
        verified: authProfile.is_verified || false,
        gradYear: authProfile.grad_year,
        degree: authProfile.degree,
        dateOfBirth: authProfile.date_of_birth,
        profilePictureUrl: authProfile.profile_picture_url,
      });
      setError(null);
    } else if (user && !authLoading) {
      setError('Failed to load profile data. Please try signing in again.');
    }
  }, [authProfile, user, authLoading]);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (user) {
        try {
          const count = await getUnreadMessageCount();
          setUnreadMessageCount(count);
        } catch (error) {
          console.error('Error fetching unread message count:', error);
        }
      }
    };

    fetchUnreadCount();
    
    // Refresh count when screen comes into focus
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await updateProfile({
        first_name: profile.firstName,
        last_name: profile.lastName,
        school: profile.university,
        phone_number: profile.phone,
        description: profile.bio,
      });
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
      } else {
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } else {
              router.replace('/auth/login');
            }
          }
        },
      ]
    );
  };

  const updateProfileField = (field: keyof UserProfile, value: string | number) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleProfilePicturePress = () => {
    if (!isEditing) {
      // If not editing, show expanded image modal
      if (profile?.profilePictureUrl) {
        setShowImageModal(true);
      }
      return;
    }

    // If editing, show photo options
    const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleTakePhoto();
          } else if (buttonIndex === 1) {
            handlePickImage();
          }
        }
      );
    } else {
      Alert.alert(
        'Profile Picture',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Gallery', onPress: handlePickImage },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      setUploadingImage(true);
      console.log('📸 Taking photo with built-in cropping...');
      
      const result = await takePhoto();
      
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Photo taken successfully, processing...');
        await uploadAndUpdateProfilePicture(asset.uri, asset.base64 || undefined);
      } else if (result?.canceled) {
        console.log('🚫 User cancelled camera');
      }
    } catch (error: any) {
      console.error('❌ Camera error:', error);
      const errorMessage = error?.message || 'Failed to take photo. Please try again.';
      
      if (errorMessage.includes('permission') || errorMessage.includes('Camera')) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera permissions in your device settings to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    try {
      setUploadingImage(true);
      console.log('🖼️ Opening gallery with cropping...');
      
      const result = await pickImage();
      
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Image selected successfully, processing...');
        await uploadAndUpdateProfilePicture(asset.uri, asset.base64 || undefined);
      } else if (result?.canceled) {
        console.log('🚫 User cancelled image picker');
      }
    } catch (error: any) {
      console.error('❌ Image picker error:', error);
      const errorMessage = error?.message || 'Failed to pick image. Please try again.';
      
      if (errorMessage.includes('permission') || errorMessage.includes('Photo library')) {
        Alert.alert(
          'Photo Library Permission Required',
          'Please enable photo library permissions in your device settings to select photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadAndUpdateProfilePicture = async (uri: string, base64?: string) => {
    if (!user || !base64) {
      console.error('❌ Missing user or base64 data');
      Alert.alert('Error', 'Missing required data for upload');
      return;
    }

    try {
      console.log('🚀 Starting profile picture update...');
      setUploadingImage(true);
      
      // Get current profile picture URL to delete old one
      const oldImageUrl = profile?.profilePictureUrl;
      
      // Use complete workflow that handles upload, update, and cleanup
      const result = await updateCompleteProfilePicture(
        user.id, 
        uri, 
        base64, 
        oldImageUrl
      );
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update profile picture');
        return;
      }

      // Update local profile state immediately for better UX
      if (profile && result.url) {
        setProfile(prev => prev ? { ...prev, profilePictureUrl: result.url } : null);
      }
      
      // Refresh profile data from server to ensure consistency
      await refreshProfile();
      
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('❌ Error in profile picture update:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };


  // Show loading spinner while auth is loading
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error if profile failed to load
  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Failed to load profile. Please sign in again.'}
          </Text>
          <Button
            title="Sign In Again"
            onPress={() => router.replace('/auth/login')}
            style={styles.errorButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    { title: 'Ride History', icon: '🚗', onPress: () => router.push('/ride-history') },
    { title: 'Manage Vehicles', icon: '🚙', onPress: () => router.push('/vehicles') },
    { title: 'Payment Methods', icon: '💳', onPress: () => {} },
    { 
      title: 'Notifications', 
      icon: '🔔', 
      onPress: () => router.push('/notifications'),
      badge: unreadMessageCount > 0 ? unreadMessageCount : undefined
    },
    { title: 'Help & Support', icon: '❓', onPress: () => {} },
    { title: 'Terms & Privacy', icon: '📋', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerActions}>
            <NotificationIcon size={24} color={Colors.text} />
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleProfilePicturePress}
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                {profile.profilePictureUrl ? (
                  <Image 
                    source={{ uri: profile.profilePictureUrl }} 
                    style={styles.avatarImage}
                    onError={(error) => {
                      console.warn('⚠️ Profile image failed to load:', error.nativeEvent.error);
                      // Optionally clear the broken URL from state
                      setProfile(prev => prev ? { ...prev, profilePictureUrl: undefined } : null);
                    }}
                  />
                ) : (
                  <UserIcon size={40} color={Colors.white} />
                )}
                {uploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color={Colors.white} />
                  </View>
                )}
              </View>
              {isEditing && (
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>✏️</Text>
                </View>
              )}
              {profile.verified && (
                <View style={styles.verifiedBadge}>
                  <CheckIcon size={12} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile.firstName} {profile.lastName}
              </Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.totalRides}</Text>
                  <Text style={styles.statLabel}>Rides</Text>
                </View>
                <View style={styles.statDivider} />
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => router.push({ pathname: '/ratings/[userId]', params: { userId: user?.id || '' } })}
                >
                  <Text style={styles.statValue}>⭐ {profile.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card>

        <Card variant="elevated" style={styles.formCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.nameRow}>
            <Input
              label="First Name"
              value={profile.firstName}
              onChangeText={(value) => updateProfileField('firstName', value)}
              editable={isEditing}
              containerStyle={styles.nameInput}
            />
            <Input
              label="Last Name"
              value={profile.lastName}
              onChangeText={(value) => updateProfileField('lastName', value)}
              editable={isEditing}
              containerStyle={styles.nameInput}
            />
          </View>

          <Input
            label="Email"
            value={profile.email}
            leftIcon={<MailIcon size={20} color={Colors.textSecondary} />}
            editable={false}
            style={styles.disabledInput}
          />

          <Input
            label="University"
            value={profile.university}
            onChangeText={(value) => updateProfileField('university', value)}
            editable={isEditing}
          />

          {profile.gradYear && (
            <Input
              label="Graduation Year"
              value={profile.gradYear.toString()}
              editable={false}
              style={styles.disabledInput}
            />
          )}

          {profile.degree && (
            <Input
              label="Degree Level"
              value={profile.degree.charAt(0).toUpperCase() + profile.degree.slice(1)}
              editable={false}
              style={styles.disabledInput}
            />
          )}

          <Input
            label="Phone Number"
            value={profile.phone}
            onChangeText={(value) => updateProfileField('phone', value)}
            keyboardType="phone-pad"
            editable={isEditing}
          />

          <Input
            label="Bio"
            value={profile.bio}
            onChangeText={(value) => updateProfileField('bio', value)}
            multiline
            numberOfLines={3}
            editable={isEditing}
            style={styles.bioInput}
          />

          {isEditing && (
            <Button
              title="Save Changes"
              onPress={handleSaveProfile}
              loading={loading}
              style={styles.saveButton}
            />
          )}
        </Card>

        <Card variant="elevated" style={styles.menuCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.lastMenuItem,
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuTitle}>{item.title}</Text>
                {item.badge && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <Button
          title="Logout"
          onPress={handleSignOut}
          variant="outline"
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Profile Picture Expanded Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.expandedImageContainer}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              {profile?.profilePictureUrl ? (
                <Image 
                  source={{ uri: profile.profilePictureUrl }} 
                  style={styles.expandedImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.expandedPlaceholder}>
                  <UserIcon size={80} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.closeModalText}>✕</Text>
            </TouchableOpacity>
            
            {/* User name below image */}
            <Text style={styles.expandedImageName}>
              {profile?.firstName} {profile?.lastName}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 120, // Add space for floating navbar
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  editButtonText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  editBadgeText: {
    fontSize: 12,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  disabledInput: {
    opacity: 0.6,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: Spacing.md,
  },
  menuCard: {
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: FontSize.lg,
    marginRight: Spacing.md,
  },
  menuTitle: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  menuArrow: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  menuBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoutButton: {
    borderColor: Colors.error,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  errorButton: {
    marginTop: Spacing.md,
  },
  // Modal styles for expanded profile picture
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  expandedImageContainer: {
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    borderRadius: (Dimensions.get('window').width * 0.8) / 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
  expandedPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 60,
    right: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  expandedImageName: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
});
