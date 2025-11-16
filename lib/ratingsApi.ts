import { reviewApi } from './apiClient';
import { supabase } from './supabase';
// Updated to use server endpoints for 48-hour rating window validation
// Server handles all rating eligibility and validation logic

export interface EligibleUser {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  role: 'driver' | 'passenger';
  already_rated: boolean;
}

export interface RideRatingEligibility {
  rideId: string;
  isEligible: boolean;
  reason?: string;
}

export interface SubmitRatingData {
  rideId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  isDriverReview: boolean;
}

export interface RatingStats {
  totalReviews: number;
  averageRating: number;
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
  driverReviews: number;
  passengerReviews: number;
}

/**
 * Check if a ride is eligible for rating (completed and within 48 hours)
 * Now uses server-side validation for proper 48-hour window enforcement
 */
export async function checkRideEligibility(rideId: string): Promise<RideRatingEligibility> {
  try {
    const result = await reviewApi.checkRideEligibility(rideId);
    
    return {
      rideId,
      isEligible: result.isEligible,
      reason: result.reason,
    };
  } catch (error: any) {
    console.error('Error checking ride eligibility:', error);
    throw new Error(error.message || 'Failed to check ride eligibility');
  }
}

/**
 * Get all eligible users to rate for a specific ride
 * Now uses server-side endpoint with proper authentication
 */
export async function getEligibleUsersToRate(rideId: string, userId: string): Promise<EligibleUser[]> {
  try {
    const users = await reviewApi.getEligibleUsersToRate(rideId);
    
    // Map server response to expected format
    return users.map(user => ({
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_picture_url: user.profile_picture_url,
      role: user.role,
      already_rated: user.already_rated,
    }));
  } catch (error: any) {
    console.error('Error fetching eligible users:', error);
    throw new Error(error.message || 'Failed to fetch eligible users');
  }
}

/**
 * Submit a single rating with server-side 48-hour validation
 */
export async function submitRating(ratingData: SubmitRatingData): Promise<void> {
  try {
    const result = await reviewApi.submitRating({
      ride_id: ratingData.rideId,
      reviewed_user_id: ratingData.revieweeId,
      rating: ratingData.rating,
      comment: ratingData.comment?.trim() || undefined,
      review_type: (ratingData.isDriverReview ? 'driver' : 'passenger') as 'driver' | 'passenger',
    });
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit rating');
    }
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    throw new Error(error.message || 'Failed to submit rating');
  }
}

/**
 * Submit multiple ratings for a ride with server-side validation
 */
export async function submitMultipleRatings(ratings: SubmitRatingData[]): Promise<void> {
  try {
    const ratingsData = ratings.map(rating => ({
      ride_id: rating.rideId,
      reviewed_user_id: rating.revieweeId,
      rating: rating.rating,
      comment: rating.comment?.trim() || undefined,
      review_type: (rating.isDriverReview ? 'driver' : 'passenger') as 'driver' | 'passenger',
    }));

    const result = await reviewApi.submitMultipleRatings(ratingsData);
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to submit ratings');
    }
  } catch (error: any) {
    console.error('Error submitting multiple ratings:', error);
    throw new Error(error.message || 'Failed to submit ratings');
  }
}

/**
 * Get rating statistics for a user
 */
export async function getUserRatingStats(userId: string): Promise<RatingStats | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_rating_stats', { user_id: userId });

    if (error) throw error;

    if (data && data.length > 0) {
      const stats = data[0];
      return {
        totalReviews: stats.total_reviews,
        averageRating: stats.average_rating,
        fiveStar: stats.five_star,
        fourStar: stats.four_star,
        threeStar: stats.three_star,
        twoStar: stats.two_star,
        oneStar: stats.one_star,
        driverReviews: stats.driver_reviews,
        passengerReviews: stats.passenger_reviews,
      };
    }

    return null;
  } catch (error: any) {
    console.error('Error fetching rating stats:', error);
    throw new Error(error.message || 'Failed to fetch rating statistics');
  }
}

/**
 * Get reviews for a user with pagination
 */
export async function getUserReviews(
  userId: string, 
  filter: 'all' | 'driver' | 'passenger' = 'all',
  limit: number = 20,
  offset: number = 0
) {
  try {
    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        is_driver_review,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey (
          id,
          first_name,
          last_name,
          profile_picture_url
        ),
        ride:rides (
          id,
          title,
          departure_location,
          destination_location,
          departure_date
        )
      `)
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === 'driver') {
      query = query.eq('is_driver_review', true);
    } else if (filter === 'passenger') {
      query = query.eq('is_driver_review', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error: any) {
    console.error('Error fetching user reviews:', error);
    throw new Error(error.message || 'Failed to fetch reviews');
  }
}

/**
 * Get rides that are eligible for rating by the current user
 * Now uses server-side endpoint with proper 48-hour validation
 */
export async function getEligibleRidesForRating(userId: string) {
  try {
    const eligibleRides = await reviewApi.getEligibleRidesForRating();
    return eligibleRides;
  } catch (error: any) {
    console.error('Error fetching eligible rides:', error);
    
    // If server endpoints aren't available, provide helpful error message
    if (error.message.includes('server') || error.message.includes('Network') || error.message.includes('500')) {
      throw new Error('Rating server endpoints not configured. Please add the rating endpoints to your Python server. See SERVER_INTEGRATION_GUIDE.md for instructions.');
    }
    
    throw new Error(error.message || 'Failed to fetch eligible rides');
  }
}

/**
 * Check if user has already rated someone for a specific ride
 */
export async function hasUserRatedForRide(rideId: string, reviewerId: string, revieweeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('ride_id', rideId)
      .eq('reviewer_id', reviewerId)
      .eq('reviewee_id', revieweeId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error;
    }

    return !!data;
  } catch (error: any) {
    console.error('Error checking if user has rated:', error);
    return false;
  }
}

/**
 * Update an existing rating (within 48 hours)
 */
export async function updateRating(
  reviewId: string, 
  rating: number, 
  comment?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        rating,
        comment: comment?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error updating rating:', error);
    throw new Error(error.message || 'Failed to update rating');
  }
}
