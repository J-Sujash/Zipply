import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, supabase } from '../lib/supabase';
import { profileApi } from '../lib/apiClient';
import { storeSession, getStoredSession, removeSession } from '../lib/sessionStorage';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string, type?: 'signup' | 'recovery') => Promise<{ error: any; data?: any }>;
  forgotPassword: (email: string) => Promise<{ error: any }>;
  resetPassword: (newPassword: string) => Promise<{ error: any; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    // Restore session from secure storage on app start (Uber-style persistent login)
    const initAuth = async () => {
      try {
        console.log('🔄 Initializing auth - checking for stored session...');
        
        // First, try to get stored session from secure storage
        const storedSession = await getStoredSession();
        
        if (storedSession) {
          console.log('📦 Found stored session, attempting to restore...');
          
          // Try to set the session (Supabase will refresh if needed)
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });
          
          if (error) {
            console.error('❌ Error restoring session:', error);
            // Session is invalid or expired, remove it
            await removeSession();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          
          if (session) {
            console.log('✅ Session restored successfully!');
            setSession(session);
            setUser(session.user);
            
            // Store the refreshed session
            await storeSession(session);
            
            // Fetch profile
            if (session.user) {
              await fetchProfile(session.user.id);
            }
            return;
          }
        }
        
        // No stored session, try to get current session from Supabase
        console.log('📦 No stored session, checking Supabase...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('✅ Found active Supabase session');
          setSession(session);
          setUser(session.user);
          
          // Store it for next time
          await storeSession(session);
          
          if (session.user) {
            await fetchProfile(session.user.id);
          }
        } else {
          console.log('📦 No active session found');
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('💥 Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes and persist sessions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', { event, hasUser: !!session?.user });
      
      // Persist session to secure storage whenever it changes
      if (session) {
        await storeSession(session);
      } else {
        await removeSession();
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // If user exists, fetch their profile
      if (session?.user) {
        console.log('🔍 Fetching profile for user:', session.user.id);
        await fetchProfile(session.user.id);
      } else {
        console.log('🔍 No user session, clearing profile and setting loading false');
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialized]);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Starting profile fetch for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching profile:', error);
      } else {
        console.log('✅ Profile fetched successfully:', data?.first_name);
        setProfile(data);
      }
    } catch (error) {
      console.error('💥 Exception fetching profile:', error);
    } finally {
      console.log('🔍 Setting loading to false after profile fetch');
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, profileData: Partial<Profile>) => {
    try {
      setLoading(true);
      
      console.log('🔐 Starting signup process for:', email);
      
      // Validate email is .edu
      if (!email.endsWith('.edu')) {
        return { error: { message: 'Please use a valid .edu email address' } };
      }

      console.log('📝 Calling Supabase signUp (OTP-only mode)...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // CRITICAL: No emailRedirectTo = OTP-only verification
          // This prevents auto-verification via email links
          emailRedirectTo: undefined,
          captchaToken: undefined,
          data: {
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            date_of_birth: profileData.date_of_birth,
            school: profileData.school,
            grad_year: profileData.grad_year,
            degree: profileData.degree,
            gender: profileData.gender,
            description: profileData.description,
          },
        },
      });

      console.log('📊 Signup response:', { 
        userId: data?.user?.id, 
        error: error?.message,
        emailConfirmed: data?.user?.email_confirmed_at,
        confirmationSent: data?.user?.confirmation_sent_at
      });

      // Check if user was auto-verified (this should NOT happen)
      if (data?.user?.email_confirmed_at) {
        console.warn('⚠️ WARNING: User was auto-verified! This should not happen in OTP-only mode.');
        console.warn('Check Supabase email template for auto-confirmation links.');
      }

      if (error) {
        console.error('❌ Signup error:', error);
        
        // If it's a database error, try to create the user without the trigger
        if (error.message.includes('Database error saving new user') || 
            error.message.includes('trigger') || 
            error.message.includes('profile')) {
          console.log('🔄 Attempting manual user creation...');
          
          // Try signing up without metadata first
          const { data: retryData, error: retryError } = await supabase.auth.signUp({
            email,
            password,
          });
          
          if (retryError) {
            console.error('❌ Retry signup failed:', retryError);
            return { error: retryError };
          }
          
          // If successful, manually create the profile
          if (retryData?.user?.id) {
            await createProfileManually(retryData.user.id, email, profileData);
          }
          
          console.log('✅ Manual signup successful!');
          return { error: null };
        }
        
        return { error };
      }

      console.log('✅ Signup successful!');
      return { error: null };
    } catch (error) {
      console.error('💥 Signup exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('🔐 Starting signin process for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('📊 Signin response:', { data: data?.user?.id, error: error?.message });
      
      if (error) {
        console.error('❌ Signin error:', error);
        setLoading(false);
        return { error };
      }
      
      console.log('✅ Signin successful!');
      
      // Immediately update state with the new session
      if (data?.session) {
        console.log('🔄 Updating auth state immediately...');
        setSession(data.session);
        setUser(data.session.user);
        
        // Store session in secure storage for persistent login
        await storeSession(data.session);
        console.log('💾 Session stored securely for persistent login');
        
        // Fetch profile
        if (data.session.user) {
          await fetchProfile(data.session.user.id);
        }
      }
      
      // Sync with application server after successful login
      if (data?.user) {
        try {
          console.log('🔄 Syncing with application server...');
          await profileApi.getProfile();
          console.log('✅ Server sync successful!');
        } catch (serverError) {
          console.warn('⚠️ Server sync failed (non-critical):', serverError);
          // Don't fail login if server sync fails - user can still use the app
        }
      }
      
      // Ensure loading is set to false after all operations
      setLoading(false);
      console.log('✅ SignIn complete, loading set to false');
      
      return { error: null };
    } catch (error) {
      console.error('💥 Signin exception:', error);
      setLoading(false);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('🔓 Signing out user...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Sign out error:', error);
        throw error; // Throw error so calling code can handle it
      } else {
        console.log('✅ Signed out successfully');
        
        // Clear session from secure storage
        await removeSession();
        console.log('🗑️ Session removed from secure storage');
        
        // Clear any local state
        setProfile(null);
      }
    } catch (error) {
      console.error('💥 Sign out exception:', error);
      throw error; // Re-throw so calling code can handle it
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) {
        return { error: { message: 'No user logged in' } };
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { error };
      }

      // Refresh profile data
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const createProfileManually = async (userId: string, email: string, profileData: Partial<Profile>) => {
    console.log('👤 Creating profile manually...');
    
    // Wait a moment for the auth session to be established
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        date_of_birth: profileData.date_of_birth || new Date().toISOString().split('T')[0],
        school_email: email,
        school: profileData.school || '',
        grad_year: profileData.grad_year || new Date().getFullYear() + 4,
        degree: profileData.degree || 'bachelor',
        gender: profileData.gender || null,
        description: profileData.description || null,
      });
    
    if (profileError) {
      console.error('❌ Profile creation failed:', profileError);
      console.log('Profile error details:', profileError);
      console.log('⚠️ User created but profile creation failed');
    } else {
      console.log('✅ Profile created manually!');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const resendConfirmation = async (email: string) => {
    try {
      console.log('📧 Resending OTP-only confirmation for:', email);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          // CRITICAL: Explicitly set to undefined to prevent auto-verification
          emailRedirectTo: undefined,
          captchaToken: undefined,
        }
      });
      
      if (error) {
        console.error('❌ Resend confirmation error:', error);
        return { error };
      }
      
      console.log('✅ OTP-only confirmation email resent successfully!');
      return { error: null };
    } catch (error) {
      console.error('💥 Resend confirmation exception:', error);
      return { error };
    }
  };

  const verifyOtp = async (email: string, token: string, type: 'signup' | 'recovery' = 'signup') => {
    try {
      console.log('🔐 Verifying OTP code:', token, 'for email:', email, 'type:', type);
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type
      });
      
      console.log('📊 OTP verification response:', { 
        data: data?.user?.id, 
        error: error?.message,
        session: data?.session?.user?.id,
        type 
      });
      
      if (error) {
        console.error('❌ OTP verification error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          code: error.code
        });
        return { error };
      }
      
      if (data?.session) {
        console.log('✅ OTP verified successfully! Session created.');
        console.log('👤 User confirmed:', data.session.user.email_confirmed_at ? 'Yes' : 'No');
        
        // Store session in secure storage for persistent login
        await storeSession(data.session);
        console.log('💾 Session stored securely for persistent login');
      }
      
      return { error: null, data };
    } catch (error) {
      console.error('💥 OTP verification exception:', error);
      return { error };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      console.log('🔒 Requesting password reset for:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // No redirect URL - OTP only mode for mobile
        redirectTo: undefined,
      });
      
      if (error) {
        console.error('❌ Password reset request error:', error);
        return { error };
      }
      
      console.log('✅ Password reset OTP sent successfully!');
      return { error: null };
    } catch (error) {
      console.error('💥 Password reset exception:', error);
      return { error };
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      console.log('🔑 Updating password...');
      
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error('❌ Password update error:', error);
        return { error };
      }
      
      console.log('✅ Password updated successfully in database!');
      return { error: null, data };
    } catch (error) {
      console.error('💥 Password update exception:', error);
      return { error };
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
    resendConfirmation,
    verifyOtp,
    forgotPassword,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
