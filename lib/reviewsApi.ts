import { reviewApi, ApiReview } from './apiClient';

// Updated review functions to use API instead of direct Supabase
export interface SubmitRatingData {
  rideId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  isDriverReview: boolean;
}

export interface RatingStats {
  user_id: string;
  total_reviews: number;
  average_rating: number;
  driver_reviews: {
    count: number;
    average_rating: number;
    rating_distribution: { [key: number]: number };
  };
  passenger_reviews: {
    count: number;
    average_rating: number;
    rating_distribution: { [key: number]: number };
  };
  overall_rating_distribution: { [key: number]: number };
}

/**
 * Submit a single rating
 */
export async function submitRating(ratingData: SubmitRatingData): Promise<ApiReview> {
  try {
    return await reviewApi.createReview({
      ride_id: ratingData.rideId,
      reviewed_user_id: ratingData.revieweeId,
      rating: ratingData.rating,
      comment: ratingData.comment,
      review_type: ratingData.isDriverReview ? 'driver' : 'passenger',
    });
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    throw new Error(error.message || 'Failed to submit rating');
  }
}

/**
 * Submit multiple ratings for a ride
 */
export async function submitMultipleRatings(ratings: SubmitRatingData[]): Promise<ApiReview[]> {
  try {
    const results = await Promise.all(
      ratings.map(rating => submitRating(rating))
    );
    return results;
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
    const stats = await reviewApi.getUserReviewStats(userId);
    return stats as RatingStats;
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
): Promise<ApiReview[]> {
  try {
    const filters: any = {
      reviewed_user_id: userId,
      limit,
      offset,
    };

    if (filter === 'driver') {
      filters.review_type = 'driver';
    } else if (filter === 'passenger') {
      filters.review_type = 'passenger';
    }

    return await reviewApi.getReviews(filters);
  } catch (error: any) {
    console.error('Error fetching user reviews:', error);
    throw new Error(error.message || 'Failed to fetch reviews');
  }
}

/**
 * Get reviews written by the current user
 */
export async function getMyReviews(
  asReviewer: boolean = true,
  limit: number = 20,
  offset: number = 0
): Promise<ApiReview[]> {
  try {
    return await reviewApi.getMyReviews(asReviewer, limit, offset);
  } catch (error: any) {
    console.error('Error fetching my reviews:', error);
    throw new Error(error.message || 'Failed to fetch reviews');
  }
}

/**
 * Update an existing rating
 */
export async function updateRating(
  reviewId: string, 
  rating: number, 
  comment?: string
): Promise<ApiReview> {
  try {
    return await reviewApi.updateReview(reviewId, { rating, comment });
  } catch (error: any) {
    console.error('Error updating rating:', error);
    throw new Error(error.message || 'Failed to update rating');
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
  try {
    await reviewApi.deleteReview(reviewId);
  } catch (error: any) {
    console.error('Error deleting review:', error);
    throw new Error(error.message || 'Failed to delete review');
  }
}

/**
 * Get ride review summary
 */
export async function getRideReviewSummary(rideId: string) {
  try {
    return await reviewApi.getRideReviewSummary(rideId);
  } catch (error: any) {
    console.error('Error fetching ride review summary:', error);
    throw new Error(error.message || 'Failed to fetch ride review summary');
  }
}

// Legacy compatibility functions (to maintain existing code)
export async function checkRideEligibility(rideId: string) {
  // This would need to be implemented based on your business logic
  // For now, return a simple check
  return {
    rideId,
    isEligible: true,
    reason: undefined,
  };
}

export async function getEligibleUsersToRate(rideId: string, userId: string) {
  // This would need custom logic or a new API endpoint
  // For now, return empty array
  return [];
}

export async function getEligibleRidesForRating(userId: string) {
  // This would need custom logic or a new API endpoint
  // For now, return empty array
  return [];
}

export async function hasUserRatedForRide(rideId: string, reviewerId: string, revieweeId: string): Promise<boolean> {
  try {
    const reviews = await reviewApi.getReviews({
      ride_id: rideId,
      reviewer_id: reviewerId,
      reviewed_user_id: revieweeId,
    });
    return reviews.length > 0;
  } catch (error: any) {
    console.error('Error checking if user has rated:', error);
    return false;
  }
}
