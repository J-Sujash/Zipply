/**
 * Hook for efficient authentication token management
 * Reduces unnecessary token fetches and API calls
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import apiClient from '../lib/apiClient';

interface AuthTokenState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuthToken = () => {
  const [state, setState] = useState<AuthTokenState>({
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Get token only when needed
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || null;
      
      setState(prev => ({
        ...prev,
        token,
        isAuthenticated: !!token,
        isLoading: false,
        error: null,
      }));
      
      return token;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message,
      }));
      return null;
    }
  }, []);

  // Refresh token when needed
  const refreshToken = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    return await getToken();
  }, [getToken]);

  // Clear token on sign out
  const clearToken = useCallback(() => {
    setState({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    
    // Clear API client cache
    apiClient.clearTokenCache();
  }, []);

  // Initialize token on mount
  useEffect(() => {
    getToken();
  }, [getToken]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          clearToken();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const token = session?.access_token || null;
          setState({
            token,
            isAuthenticated: !!token,
            isLoading: false,
            error: null,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [clearToken]);

  return {
    ...state,
    getToken,
    refreshToken,
    clearToken,
  };
};
