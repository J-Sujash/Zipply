import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { View, Text, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔗 Handling auth callback...');
        
        // Get the current session to check if user is now confirmed
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Auth callback error:', error);
          router.replace('/auth/login' as any);
          return;
        }

        if (session?.user?.email_confirmed_at) {
          console.log('✅ Email confirmed! Redirecting to app...');
          router.replace('/(tabs)/home' as any);
        } else {
          console.log('⏳ Email not confirmed yet...');
          router.replace('/auth/login' as any);
        }
      } catch (error) {
        console.error('💥 Auth callback exception:', error);
        router.replace('/auth/login' as any);
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: Colors.background 
    }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ 
        marginTop: 16, 
        color: Colors.text,
        fontSize: 16 
      }}>
        Verifying your email...
      </Text>
    </View>
  );
}
