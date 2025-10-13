import { supabase } from './supabase';

/**
 * Test function to verify profile picture functionality
 * Call this from your app to test the database connection
 */
export async function testProfilePictureSetup(userId: string) {
  console.log('🧪 Testing profile picture setup...');
  
  try {
    // Test 1: Check if profiles table exists and has profile_picture_url column
    console.log('1️⃣ Testing profiles table...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, profile_picture_url')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('❌ Profile table test failed:', profileError);
      return false;
    }
    
    console.log('✅ Profile table accessible:', {
      id: profileData.id,
      name: `${profileData.first_name} ${profileData.last_name}`,
      hasProfilePicture: !!profileData.profile_picture_url,
      currentUrl: profileData.profile_picture_url
    });
    
    // Test 2: Check storage bucket access
    console.log('2️⃣ Testing storage bucket...');
    const { data: bucketData, error: bucketError } = await supabase.storage
      .from('profile-pictures')
      .list('', { limit: 1 });
    
    if (bucketError) {
      console.error('❌ Storage bucket test failed:', bucketError);
      return false;
    }
    
    console.log('✅ Storage bucket accessible');
    
    // Test 3: Test profile update capability
    console.log('3️⃣ Testing profile update...');
    const testUrl = 'https://example.com/test.jpg';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: testUrl })
      .eq('id', userId);
    
    if (updateError) {
      console.error('❌ Profile update test failed:', updateError);
      return false;
    }
    
    // Revert the test change
    await supabase
      .from('profiles')
      .update({ profile_picture_url: profileData.profile_picture_url })
      .eq('id', userId);
    
    console.log('✅ Profile update capability confirmed');
    
    console.log('🎉 All tests passed! Profile picture functionality is ready.');
    return true;
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    return false;
  }
}

/**
 * Get current user's profile picture URL
 */
export async function getCurrentProfilePicture(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile picture:', error);
      return null;
    }
    
    return data.profile_picture_url || null;
  } catch (error) {
    console.error('Error in getCurrentProfilePicture:', error);
    return null;
  }
}

/**
 * Verify that a profile picture URL is accessible
 */
export async function verifyProfilePictureUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error verifying profile picture URL:', error);
    return false;
  }
}
