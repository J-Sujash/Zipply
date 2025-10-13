import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Try multiple ways to get environment variables
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.supabaseUrl ||
  'https://nnbekvfmsuprjvzscbpk.supabase.co';

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uYmVrdmZtc3Vwcmp2enNjYnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjQxNTMsImV4cCI6MjA3NTAwMDE1M30.XRt6rne3YCC9DjGvJbWKLwEnDD73eMVOZRfsly6b8D4';

// Debug logging
console.log('🔧 Supabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  throw new Error('Supabase configuration is missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types for our database
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  school_email: string;
  school: string;
  grad_year: number;
  degree: 'bachelor' | 'masters' | 'phd';
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  description?: string;
  profile_picture_url?: string;
  phone_number?: string;
  is_verified: boolean;
  rating: number;
  total_rides_as_driver: number;
  total_rides_as_passenger: number;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  driver_id: string;
  title: string;
  description?: string;
  departure_location: string;
  departure_latitude?: number;
  departure_longitude?: number;
  destination_location: string;
  destination_latitude?: number;
  destination_longitude?: number;
  departure_date: string;
  departure_time: string;
  estimated_duration_minutes?: number;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  car_make?: string;
  car_model?: string;
  car_color?: string;
  car_license_plate?: string;
  status: 'active' | 'completed' | 'cancelled';
  requirements?: string;
  recurring_pattern?: string;
  recurring_end_date?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  driver?: Profile;
}

export interface RideRequest {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_requested: number;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  pickup_location?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_location?: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  created_at: string;
  updated_at: string;
  // Joined data
  ride?: Ride;
  passenger?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'ride_request' | 'request_approved' | 'request_rejected' | 'ride_cancelled' | 'ride_reminder' | 'system';
  title: string;
  message: string;
  related_ride_id?: string;
  related_request_id?: string;
  is_read: boolean;
  created_at: string;
  // Joined data
  related_ride?: Ride;
  related_request?: RideRequest;
}

export interface Review {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  is_driver_review: boolean;
  created_at: string;
  // Joined data
  reviewer?: Profile;
  reviewee?: Profile;
  ride?: Ride;
}
