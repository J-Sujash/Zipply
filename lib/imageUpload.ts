import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Requests camera and media library permissions
 */
export async function requestImagePermissions(): Promise<boolean> {
  try {
    console.log('📱 Requesting camera and media library permissions...');
    
    // Check current permissions first
    const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
    const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    console.log('📷 Current camera permission:', cameraStatus.status);
    console.log('📸 Current media library permission:', mediaStatus.status);
    
    let cameraPermission = cameraStatus;
    let mediaPermission = mediaStatus;
    
    // Request camera permission if not granted
    if (cameraStatus.status !== 'granted') {
      console.log('🔐 Requesting camera permission...');
      cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission result:', cameraPermission.status);
    }
    
    // Request media library permission if not granted
    if (mediaStatus.status !== 'granted') {
      console.log('🔐 Requesting media library permission...');
      mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📸 Media library permission result:', mediaPermission.status);
    }
    
    const hasPermissions = cameraPermission.status === 'granted' && mediaPermission.status === 'granted';
    console.log('✅ All permissions granted:', hasPermissions);
    
    return hasPermissions;
  } catch (error) {
    console.error('❌ Error requesting permissions:', error);
    return false;
  }
}

/**
 * Requests only media library permissions for gallery access
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  try {
    console.log('📱 Checking media library permissions...');
    const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
    console.log('📸 Current media permission status:', mediaStatus.status);
    
    if (mediaStatus.status !== 'granted') {
      console.log('🔐 Requesting media library permission...');
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('✅ Media permission result:', mediaPermission.status);
      
      if (mediaPermission.status !== 'granted') {
        console.error('❌ Media library permission denied');
        return false;
      }
    }
    
    console.log('✅ Media library permissions granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting media library permissions:', error);
    return false;
  }
}

/**
 * Shows image picker for gallery selection with proper cropping
 */
export async function pickImage(): Promise<ImagePicker.ImagePickerResult | null> {
  try {
    console.log('🖼️ Starting gallery image picker...');
    
    // Request permissions first
    const hasPermissions = await requestMediaLibraryPermissions();
    if (!hasPermissions) {
      throw new Error('Photo library permission is required. Please enable photo access in your device settings for this app.');
    }

    console.log('📷 Launching image library...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8,
      base64: true,
      selectionLimit: 1,
    });

    if (result.canceled) {
      console.log('🚫 User cancelled image selection');
      return result;
    }

    if (result.assets && result.assets.length > 0) {
      console.log('✅ Image selected successfully');
      console.log('📄 Image details:', {
        width: result.assets[0].width,
        height: result.assets[0].height,
        hasBase64: !!result.assets[0].base64
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Error picking image:', error);
    throw error; // Re-throw so the UI can handle it properly
  }
}

/**
 * Shows camera to take a new photo with cropping
 */
export async function takePhoto(): Promise<ImagePicker.ImagePickerResult | null> {
  try {
    console.log('📷 Starting camera photo capture...');
    
    const hasPermissions = await requestImagePermissions();
    if (!hasPermissions) {
      console.error('❌ Camera permissions not granted');
      throw new Error('Camera permission is required. Please enable camera access in your device settings.');
    }

    console.log('📸 Launching camera with cropping...');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // This enables the built-in crop/edit screen
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8,
      base64: true,
      // Additional options for better cropping experience
      exif: false, // Don't need EXIF data
    });

    if (result.canceled) {
      console.log('🚫 User cancelled camera');
      return result;
    }

    if (result.assets && result.assets.length > 0) {
      console.log('✅ Photo taken and cropped successfully');
      console.log('📄 Photo details:', {
        width: result.assets[0].width,
        height: result.assets[0].height,
        hasBase64: !!result.assets[0].base64
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Error taking photo:', error);
    throw error; // Re-throw so the UI can handle it properly
  }
}

/**
 * Saves image directly to database profile table (no storage bucket needed)
 */
export async function uploadProfileImage(
  userId: string,
  imageUri: string,
  base64?: string
): Promise<ImageUploadResult> {
  try {
    console.log('📤 Starting profile image save to database:', { userId, imageUri: imageUri.substring(0, 50) + '...' });
    
    if (!base64) {
      console.error('❌ No base64 data provided');
      return { success: false, error: 'No image data provided' };
    }

    // Get file extension for proper data URL format
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    console.log('📁 Image format:', fileExt);

    // Create data URL from base64 (this can be used directly in Image components)
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log('🔄 Created data URL, size:', dataUrl.length, 'characters');

    // Save directly to profiles table
    console.log('💾 Saving to profiles table...');
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ profile_picture_url: dataUrl })
      .eq('id', userId)
      .select('profile_picture_url');
    
    if (error) {
      console.error('❌ Database save failed:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      return { 
        success: false, 
        error: `Failed to save image: ${error.message}`
      };
    }

    console.log('✅ Image saved to database successfully');
    return { success: true, url: dataUrl };
  } catch (error) {
    console.error('❌ Error saving image to database:', error);
    return { success: false, error: 'Failed to save image to database' };
  }
}


/**
 * Clears profile image from database (no storage to delete from)
 */
export async function deleteProfileImage(imageUrl: string): Promise<boolean> {
  console.log('🗑️ Profile image stored in database - no separate deletion needed');
  // Since we're storing in database, old images are automatically replaced
  // No separate cleanup needed
  return true;
}

/**
 * Updates user profile with new profile picture (database-only approach)
 */
export async function updateProfilePicture(
  userId: string,
  newImageUrl: string,
  oldImageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🖼️ Updating profile picture in database:', { userId });
    
    // No need to delete old image since it's replaced in the database
    console.log('💾 Updating database with new image...');
    
    // Update profile with new image data URL
    const { data, error } = await supabase
      .from('profiles')
      .update({ profile_picture_url: newImageUrl })
      .eq('id', userId)
      .select('profile_picture_url');

    if (error) {
      console.error('❌ Profile update error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Profile picture updated successfully in database');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

/**
 * Complete profile picture update workflow - Database only
 * Saves image as base64 data URL directly to profiles table
 */
export async function updateCompleteProfilePicture(
  userId: string,
  imageUri: string,
  base64: string,
  oldImageUrl?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log('🔄 Starting complete profile picture update (database-only)...');
    
    // Save image directly to database (no storage upload needed)
    const saveResult = await uploadProfileImage(userId, imageUri, base64);
    if (!saveResult.success || !saveResult.url) {
      return { success: false, error: saveResult.error || 'Failed to save image' };
    }
    
    console.log('✅ Complete profile picture update successful (database-only)');
    return { success: true, url: saveResult.url };
  } catch (error) {
    console.error('❌ Error in complete profile picture update:', error);
    return { success: false, error: 'Failed to update profile picture' };
  }
}
