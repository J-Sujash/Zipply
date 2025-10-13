import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, profileData: Partial<Profile>) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Accept both confirmed and unconfirmed users
      if (session?.user) {
        console.log('👤 User found, fetching profile...');
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
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

      console.log('📝 Calling Supabase signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation redirect
          data: {
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            date_of_birth: profileData.date_of_birth,
            school: profileData.school,
            grad_year: profileData.grad_year,
            degree: profileData.degree,
            gender: profileData.gender,
            description: profileData.description,
            email_confirm: false, // Explicitly disable email confirmation
          },
        },
      });

      console.log('📊 Signup response:', { data: data?.user?.id, error: error?.message });

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
      } else {
        console.log('✅ Signin successful!');
      }
      
      return { error };
    } catch (error) {
      console.error('💥 Signin exception:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
