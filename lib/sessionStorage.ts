import * as SecureStore from 'expo-secure-store';
import { Session } from '@supabase/supabase-js';

const SESSION_KEY = 'supabase_session';

/**
 * Store Supabase session in secure storage
 * This stores the refresh token securely for persistent login
 */
export const storeSession = async (session: Session | null): Promise<void> => {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      console.log('✅ Session stored securely');
    } else {
      await removeSession();
    }
  } catch (error) {
    console.error('❌ Error storing session:', error);
    throw error;
  }
};

/**
 * Retrieve stored Supabase session from secure storage
 */
export const getStoredSession = async (): Promise<Session | null> => {
  try {
    const sessionString = await SecureStore.getItemAsync(SESSION_KEY);
    if (sessionString) {
      const session = JSON.parse(sessionString) as Session;
      console.log('✅ Stored session retrieved');
      return session;
    }
    return null;
  } catch (error) {
    console.error('❌ Error retrieving stored session:', error);
    return null;
  }
};

/**
 * Remove stored session from secure storage
 */
export const removeSession = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    console.log('✅ Session removed from secure storage');
  } catch (error) {
    console.error('❌ Error removing session:', error);
    // Don't throw - this is cleanup, shouldn't break the app
  }
};

