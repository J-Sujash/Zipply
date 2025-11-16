/**
 * Direct Database Review Service
 * Works directly with Supabase database without server API
 */

import { supabase } from './supabase';

export interface ReviewData {
  id?: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  is_driver_review: boolean;
  is_anonymous?: boolean;
  created_at?: string;
}

export interface EligibleRide {
  id: string;
  title: string;
  departure_date: string;
  departure_time: string;
  departure_location: string;
  destination_location: string;
  driver_id: string;
  created_at: string;
}

export interface EligibleUser {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  is_driver: boolean;
}

class ReviewService {
  /**
   * Get rides eligible for rating (within 48 hours of completion)
   */
  async getEligibleRides(userId: string): Promise<EligibleRide[]> {
    try {
      console.log('🔍 Getting eligible rides for user:', userId);
      
      // Get current time minus 48 hours
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      
      // Query rides where user was driver or passenger, completed within 48 hours
      const { data: rides, error } = await supabase
        .from('rides')
        .select(`
          id, title, departure_date, departure_time, 
          departure_location, destination_location, 
          driver_id, created_at
        `)
        .eq('status', 'completed')
        .gte('created_at', fortyEightHoursAgo.toISOString())
        .or(`driver_id.eq.${userId},id.in.(${await this.getUserRideIds(userId)})`);

      if (error) {
        console.error('Error fetching eligible rides:', error);
        throw error;
      }

      console.log('✅ Found eligible rides:', rides?.length || 0);
      return rides || [];
      
    } catch (error) {
      console.error('Error in getEligibleRides:', error);
      throw error;
    }
  }

  /**
   * Get ride IDs where user was a passenger
   */
  private async getUserRideIds(userId: string): Promise<string> {
    const { data: bookings } = await supabase
      .from('ride_requests')
      .select('ride_id')
      .eq('passenger_id', userId)
      .eq('status', 'approved');
    
    return bookings?.map(b => b.ride_id).join(',') || '';
  }

  /**
   * Get users eligible to be rated for a specific ride
   */
  async getEligibleUsersToRate(rideId: string, currentUserId: string): Promise<EligibleUser[]> {
    try {
      console.log('👥 Getting eligible users for ride:', rideId);
      
      // Get ride details
      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .select('driver_id')
        .eq('id', rideId)
        .single();

      if (rideError || !ride) {
        throw new Error('Ride not found');
      }

      // Get approved passengers
      const { data: passengers, error: passengersError } = await supabase
        .from('ride_requests')
        .select(`
          passenger_id,
          profiles!ride_requests_passenger_id_fkey(
            id, first_name, last_name, profile_picture_url
          )
        `)
        .eq('ride_id', rideId)
        .eq('status', 'approved');

      if (passengersError) {
        throw passengersError;
      }

      // Get driver details
      const { data: driver, error: driverError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_picture_url')
        .eq('id', ride.driver_id)
        .single();

      if (driverError) {
        throw driverError;
      }

      const eligibleUsers: EligibleUser[] = [];

      // Add driver if current user is not the driver
      if (currentUserId !== ride.driver_id) {
        eligibleUsers.push({
          ...driver,
          is_driver: true
        });
      }

      // Add passengers if current user is not that passenger
      passengers?.forEach(passenger => {
        if (passenger.passenger_id !== currentUserId && passenger.profiles) {
          const profile = passenger.profiles as any;
          eligibleUsers.push({
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            profile_picture_url: profile.profile_picture_url,
            is_driver: false
          });
        }
      });

      console.log('✅ Found eligible users:', eligibleUsers.length);
      return eligibleUsers;
      
    } catch (error) {
      console.error('Error in getEligibleUsersToRate:', error);
      throw error;
    }
  }

  /**
   * Check if a ride is eligible for rating (using same logic as ride history)
   */
  async checkRideEligibility(rideId: string, userId: string): Promise<{
    eligible: boolean;
    reason?: string;
    timeRemaining?: number;
  }> {
    try {
      console.log('🔍 Checking ride eligibility:', rideId);
      
      // Check if ride exists and get departure info
      const { data: ride, error } = await supabase
        .from('rides')
        .select('status, departure_date, departure_time, driver_id')
        .eq('id', rideId)
        .single();

      if (error || !ride) {
        return { eligible: false, reason: 'Ride not found' };
      }

      // Check if user was part of the ride
      const wasDriver = ride.driver_id === userId;
      
      let wasPassenger = false;
      if (!wasDriver) {
        const { data: booking } = await supabase
          .from('ride_requests')
          .select('id')
          .eq('ride_id', rideId)
          .eq('passenger_id', userId)
          .eq('status', 'approved')
          .single();
        
        wasPassenger = !!booking;
      }

      if (!wasDriver && !wasPassenger) {
        return { eligible: false, reason: 'You were not part of this ride' };
      }

      // Use the same 48-hour logic as ride history page
      const isWithin48Hours = (departureDate: string, departureTime: string): boolean => {
        try {
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          const now = new Date();
          const timeSinceRide = now.getTime() - rideDateTime.getTime();
          const fortyEightHours = 48 * 60 * 60 * 1000;
          
          // Must be after the ride time and within 48 hours
          return timeSinceRide >= 0 && timeSinceRide <= fortyEightHours;
        } catch (error) {
          console.log(`❌ Error checking 48-hour window: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // Check if ride has passed and is within 48-hour window
      const [year, month, day] = ride.departure_date.split('-').map(Number);
      const [hours, minutes, seconds = 0] = ride.departure_time.split(':').map(Number);
      const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
      const now = new Date();
      const timeSinceRide = now.getTime() - rideDateTime.getTime();

      // Check if ride has happened yet
      if (timeSinceRide < 0) {
        return { eligible: false, reason: 'Ride has not happened yet' };
      }

      // Check if ride is cancelled
      if (ride.status === 'cancelled') {
        return { eligible: false, reason: 'Cannot rate cancelled rides' };
      }

      // Check 48-hour window using same logic as ride history
      if (!isWithin48Hours(ride.departure_date, ride.departure_time)) {
        const hoursSinceRide = timeSinceRide / (1000 * 60 * 60);
        if (hoursSinceRide > 48) {
          return { eligible: false, reason: 'Rating period expired (48 hours after ride)' };
        }
      }

      // Calculate time remaining
      const hoursSinceRide = timeSinceRide / (1000 * 60 * 60);
      const timeRemaining = Math.max(0, 48 - hoursSinceRide);
      
      return { 
        eligible: true, 
        timeRemaining
      };
      
    } catch (error) {
      console.error('Error checking ride eligibility:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }

  /**
   * Submit a single review
   */
  async submitReview(reviewData: ReviewData): Promise<void> {
    try {
      console.log('📝 Submitting review:', reviewData);
      
      // Check if review already exists
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('ride_id', reviewData.ride_id)
        .eq('reviewer_id', reviewData.reviewer_id)
        .eq('reviewee_id', reviewData.reviewee_id)
        .single();

      if (existing) {
        throw new Error('You have already reviewed this person for this ride');
      }

      // Insert review
      const { error } = await supabase
        .from('reviews')
        .insert({
          ride_id: reviewData.ride_id,
          reviewer_id: reviewData.reviewer_id,
          reviewee_id: reviewData.reviewee_id,
          rating: reviewData.rating,
          comment: reviewData.comment,
          is_driver_review: reviewData.is_driver_review,
          is_anonymous: reviewData.is_anonymous || false,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error submitting review:', error);
        throw error;
      }

      console.log('✅ Review submitted successfully');
      
    } catch (error) {
      console.error('Error in submitReview:', error);
      throw error;
    }
  }

  /**
   * Submit multiple reviews at once
   */
  async submitMultipleReviews(reviews: ReviewData[]): Promise<void> {
    try {
      console.log('📝 Submitting multiple reviews:', reviews.length);
      
      // Prepare reviews for insertion
      const reviewsToInsert = reviews.map(review => ({
        ride_id: review.ride_id,
        reviewer_id: review.reviewer_id,
        reviewee_id: review.reviewee_id,
        rating: review.rating,
        comment: review.comment,
        is_driver_review: review.is_driver_review,
        is_anonymous: review.is_anonymous || false,
        created_at: new Date().toISOString()
      }));

      // Insert all reviews
      const { error } = await supabase
        .from('reviews')
        .insert(reviewsToInsert);

      if (error) {
        console.error('Error submitting multiple reviews:', error);
        throw error;
      }

      console.log('✅ All reviews submitted successfully');
      
    } catch (error) {
      console.error('Error in submitMultipleReviews:', error);
      throw error;
    }
  }

  /**
   * Get reviews for a user (respecting anonymity)
   */
  async getUserReviews(userId: string): Promise<any[]> {
    try {
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, is_driver_review, is_anonymous, created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(first_name, last_name, profile_picture_url),
          ride:rides(title, departure_location, destination_location)
        `)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Process reviews to respect anonymity
      const processedReviews = (reviews || []).map(review => ({
        ...review,
        reviewer: review.is_anonymous ? {
          first_name: 'Anonymous',
          last_name: 'User',
          profile_picture_url: null
        } : review.reviewer
      }));

      return processedReviews;
      
    } catch (error) {
      console.error('Error getting user reviews:', error);
      throw error;
    }
  }

  /**
   * Get rating statistics including anonymity breakdown
   */
  async getRatingStatsWithAnonymity(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .rpc('get_rating_stats', { user_id_param: userId });

      if (error) {
        throw error;
      }

      return data?.[0] || {
        total_reviews: 0,
        average_rating: 0,
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0,
        driver_reviews: 0,
        passenger_reviews: 0,
        anonymous_reviews: 0,
        public_reviews: 0
      };
      
    } catch (error) {
      console.error('Error getting rating stats:', error);
      throw error;
    }
  }

  /**
   * Get user's own reviews (reviews they submitted)
   */
  async getUserOwnReviews(userId: string): Promise<any[]> {
    try {
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, is_driver_review, is_anonymous, created_at,
          reviewee:profiles!reviews_reviewee_id_fkey(first_name, last_name, profile_picture_url),
          ride:rides(id, title, departure_date, departure_time)
        `)
        .eq('reviewer_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return reviews || [];
      
    } catch (error) {
      console.error('Error getting user own reviews:', error);
      throw error;
    }
  }

  /**
   * Get editable reviews (within 48 hours)
   */
  async getEditableReviews(userId: string): Promise<any[]> {
    try {
      const reviews = await this.getUserOwnReviews(userId);
      
      // Filter reviews that are within 48 hours
      const editableReviews = reviews.filter(review => {
        const reviewDate = new Date(review.created_at);
        const now = new Date();
        const hoursSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceReview <= 48;
      });

      return editableReviews;
      
    } catch (error) {
      console.error('Error getting editable reviews:', error);
      throw error;
    }
  }

  /**
   * Update an existing review
   */
  async updateReview(reviewId: string, updateData: Partial<ReviewData>): Promise<void> {
    try {
      console.log('📝 Updating review:', reviewId, updateData);
      
      // Check if review exists and is within 48 hours
      const { data: existingReview, error: fetchError } = await supabase
        .from('reviews')
        .select('created_at, reviewer_id')
        .eq('id', reviewId)
        .single();

      if (fetchError || !existingReview) {
        throw new Error('Review not found');
      }

      // Check if within 48 hours
      const reviewDate = new Date(existingReview.created_at);
      const now = new Date();
      const hoursSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceReview > 48) {
        throw new Error('Review can only be edited within 48 hours of submission');
      }

      // Update the review
      const { error } = await supabase
        .from('reviews')
        .update({
          rating: updateData.rating,
          comment: updateData.comment,
          is_anonymous: updateData.is_anonymous,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) {
        console.error('Error updating review:', error);
        throw error;
      }

      console.log('✅ Review updated successfully');
      
    } catch (error) {
      console.error('Error in updateReview:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string, userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting review:', reviewId);
      
      // Check if review exists and is within 48 hours
      const { data: existingReview, error: fetchError } = await supabase
        .from('reviews')
        .select('created_at, reviewer_id')
        .eq('id', reviewId)
        .eq('reviewer_id', userId)
        .single();

      if (fetchError || !existingReview) {
        throw new Error('Review not found or you do not have permission to delete it');
      }

      // Check if within 48 hours
      const reviewDate = new Date(existingReview.created_at);
      const now = new Date();
      const hoursSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceReview > 48) {
        throw new Error('Review can only be deleted within 48 hours of submission');
      }

      // Delete the review
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('reviewer_id', userId);

      if (error) {
        console.error('Error deleting review:', error);
        throw error;
      }

      console.log('✅ Review deleted successfully');
      
    } catch (error) {
      console.error('Error in deleteReview:', error);
      throw error;
    }
  }
}

export const reviewService = new ReviewService();
