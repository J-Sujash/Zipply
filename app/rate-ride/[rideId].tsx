import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { reviewService } from '../../lib/reviewService';
import { supabase } from '../../lib/supabase';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    ClockIcon,
    StarIcon,
    UserIcon,
} from '../../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';

interface EligibleUser {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  role: 'driver' | 'passenger';
  already_rated: boolean;
  current_rating?: number;
  total_reviews?: number;
}

interface RideDetails {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  status: string;
}

interface UserRating {
  userId: string;
  rating: number;
  comment: string;
  isAnonymous: boolean;
}

const { width } = Dimensions.get('window');

export default function RateRideScreen() {
  const { user } = useAuth();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [userRatings, setUserRatings] = useState<Record<string, UserRating>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    if (rideId && user?.id) {
      fetchRideData();
    }
  }, [rideId, user?.id]);

  const fetchRideData = async () => {
    if (!rideId || !user?.id) return;

    try {
      setError(null);
      
      // Check if ride is eligible for rating using direct database service
      const eligibilityData = await reviewService.checkRideEligibility(rideId, user.id);
      console.log('🔍 Rating eligibility check:', eligibilityData);
      setIsEligible(eligibilityData.eligible);
      
      if (!eligibilityData.eligible) {
        console.log('❌ Ride not eligible for rating:', eligibilityData.reason);
        setError(eligibilityData.reason || 'This ride is not eligible for rating');
      }

      // Fetch ride details
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select(`
          id,
          title,
          departure_location,
          destination_location,
          departure_date,
          departure_time,
          status
        `)
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      setRideDetails(rideData);

      // Fetch eligible users to rate using direct database service
      const usersData = await reviewService.getEligibleUsersToRate(rideId, user.id);
      
      // Check which users have already been rated by this user for this ride
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('reviewee_id')
        .eq('ride_id', rideId)
        .eq('reviewer_id', user.id);
      
      const alreadyRatedIds = new Set(existingReviews?.map(r => r.reviewee_id) || []);
      
      // Fetch user ratings for each user (ratings they RECEIVED, not gave)
      const userIds = usersData.map(u => u.id);
      const { data: ratingsData } = await supabase
        .from('reviews')
        .select('reviewee_id, rating')
        .in('reviewee_id', userIds);
      
      if (__DEV__) {
        console.log('📊 RATINGS: Fetched ratings data:', ratingsData?.length || 0, 'reviews');
      }
      
      // Calculate average ratings for each user (their overall rating)
      const userRatings = new Map<string, { rating: number; count: number }>();
      ratingsData?.forEach(review => {
        const existing = userRatings.get(review.reviewee_id) || { rating: 0, count: 0 };
        userRatings.set(review.reviewee_id, {
          rating: existing.rating + review.rating,
          count: existing.count + 1
        });
      });
      
      if (__DEV__) {
        console.log('📊 RATINGS: Calculated ratings for users:', Array.from(userRatings.entries()));
      }

      // Convert to expected format with current ratings
      const formattedUsers = usersData.map(userData => {
        const ratingInfo = userRatings.get(userData.id);
        const currentRating = ratingInfo ? ratingInfo.rating / ratingInfo.count : undefined;
        const totalReviews = ratingInfo ? ratingInfo.count : 0;
        
        if (__DEV__) {
          console.log(`📊 RATINGS: User ${userData.first_name} ${userData.last_name} - Rating: ${currentRating}, Reviews: ${totalReviews}`);
        }
        
        return {
          user_id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          profile_picture_url: userData.profile_picture_url,
          role: userData.is_driver ? 'driver' : 'passenger' as 'driver' | 'passenger',
          already_rated: alreadyRatedIds.has(userData.id),
          current_rating: currentRating,
          total_reviews: totalReviews
        };
      });
      
      setEligibleUsers(formattedUsers);

      // Initialize ratings state
      const initialRatings: Record<string, UserRating> = {};
      formattedUsers.forEach((user) => {
        if (!user.already_rated) {
          initialRatings[user.user_id] = {
            userId: user.user_id,
            rating: 0,
            comment: '',
            isAnonymous: false,
          };
        }
      });
      setUserRatings(initialRatings);

    } catch (error: any) {
      console.error('Error fetching ride data:', error);
      setError(error.message || 'Failed to load ride data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRideData();
  };

  const updateRating = (userId: string, rating: number) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        rating,
      },
    }));
  };

  const updateComment = (userId: string, comment: string) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        comment,
      },
    }));
  };

  const updateAnonymous = (userId: string, isAnonymous: boolean) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        isAnonymous,
      },
    }));
  };

  const submitRatings = async () => {
    const ratingsToSubmit = Object.values(userRatings).filter(rating => rating.rating > 0);
    
    if (ratingsToSubmit.length === 0) {
      Alert.alert('No Ratings', 'Please rate at least one person before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare reviews data for direct database service
      const reviewsData = ratingsToSubmit.map(rating => {
        const userToRate = eligibleUsers.find(u => u.user_id === rating.userId);
        return {
          ride_id: rideId,
          reviewer_id: user?.id || '',
          reviewee_id: rating.userId,
          rating: rating.rating,
          comment: rating.comment.trim() || undefined,
          is_driver_review: userToRate?.role === 'driver',
          is_anonymous: rating.isAnonymous,
        };
      });

      // Submit all reviews using direct database service
      await reviewService.submitMultipleReviews(reviewsData);

      Alert.alert(
        'Success', 
        `Thank you for rating ${ratingsToSubmit.length} ${ratingsToSubmit.length === 1 ? 'person' : 'people'}!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

    } catch (error: any) {
      console.error('Error submitting ratings:', error);
      Alert.alert('Error', error.message || 'Failed to submit ratings. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (userId: string, currentRating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => updateRating(userId, star)}
            style={styles.starButton}
          >
            <StarIcon
              size={28}
              color={star <= currentRating ? Colors.warning : Colors.border}
              filled={star <= currentRating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Tap to rate';
    }
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !rideDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Failed to load ride data'}
          </Text>
          <Button
            title="Try Again"
            onPress={fetchRideData}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!isEligible) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeftIcon size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Rate Ride</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.ineligibleContainer}>
          <View style={styles.ineligibleIconContainer}>
            <ClockIcon size={64} color={Colors.textSecondary} />
          </View>
          <Text style={styles.ineligibleTitle}>Rating Not Available</Text>
          <Text style={styles.ineligibleText}>
            {error || 'You can only rate participants within 48 hours after a completed ride.'}
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.goBackButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const unratedUsers = eligibleUsers.filter(user => !user.already_rated);
  const ratedUsers = eligibleUsers.filter(user => user.already_rated);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Rate Ride</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Ride Details */}
        <Card variant="elevated" style={styles.rideCard}>
          <Text style={styles.rideTitle}>{rideDetails.title}</Text>
          <Text style={styles.rideRoute}>
            {rideDetails.departure_location} → {rideDetails.destination_location}
          </Text>
          <Text style={styles.rideDate}>
            {formatDate(rideDetails.departure_date)} at {formatTime(rideDetails.departure_time)}
          </Text>
        </Card>

        {/* Users to Rate */}
        {unratedUsers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Rate Your Fellow Travelers</Text>
            {unratedUsers.map((user) => (
              <Card key={user.user_id} variant="elevated" style={styles.userCard}>
                <View style={styles.userHeader}>
                  <TouchableOpacity 
                    style={styles.userInfo}
                    onPress={() => router.push(`/ratings/${user.user_id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatar}>
                      {user.profile_picture_url ? (
                        <Image 
                          source={{ uri: user.profile_picture_url }} 
                          style={styles.avatarImage}
                          onError={(error) => {
                            console.warn('⚠️ User image failed to load:', error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <UserIcon size={24} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.userDetails}>
                      <View style={styles.userNameContainer}>
                        <Text style={styles.userName}>
                          {user.first_name} {user.last_name}
                        </Text>
                        {user.current_rating && user.total_reviews > 0 ? (
                          <View style={styles.currentRatingContainer}>
                            <StarIcon size={14} color={Colors.warning} />
                            <Text style={styles.currentRatingText}>
                              {user.current_rating.toFixed(1)}
                            </Text>
                            <Text style={styles.reviewCountText}>
                              ({user.total_reviews})
                            </Text>
                          </View>
                        ) : (
                          __DEV__ && (
                            <Text style={styles.reviewCountText}>
                              Debug: No ratings
                            </Text>
                          )
                        )}
                      </View>
                      <View style={[
                        styles.roleBadge,
                        user.role === 'driver' ? styles.driverBadge : styles.passengerBadge
                      ]}>
                        <Text style={[
                          styles.roleText,
                          user.role === 'driver' ? styles.driverText : styles.passengerText
                        ]}>
                          {user.role === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Rating Stars */}
                <View style={styles.ratingSection}>
                  {renderStars(user.user_id, userRatings[user.user_id]?.rating || 0)}
                  <Text style={styles.ratingText}>
                    {getRatingText(userRatings[user.user_id]?.rating || 0)}
                  </Text>
                </View>

                {/* Comment Input */}
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment (optional)"
                  placeholderTextColor={Colors.textSecondary}
                  value={userRatings[user.user_id]?.comment || ''}
                  onChangeText={(text) => updateComment(user.user_id, text)}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />

                {/* Anonymous Toggle */}
                <View style={styles.anonymousContainer}>
                  <View style={styles.anonymousInfo}>
                    <Text style={styles.anonymousLabel}>Submit anonymously</Text>
                    <Text style={styles.anonymousDescription}>
                      Your name and profile won't be shown with this review
                    </Text>
                  </View>
                  <Switch
                    value={userRatings[user.user_id]?.isAnonymous || false}
                    onValueChange={(value) => updateAnonymous(user.user_id, value)}
                    trackColor={{ 
                      false: Colors.border || '#E5E7EB', 
                      true: Colors.primary || '#3B82F6' 
                    }}
                    thumbColor={userRatings[user.user_id]?.isAnonymous ? Colors.white || '#FFFFFF' : Colors.textSecondary || '#6B7280'}
                    ios_backgroundColor={Colors.border || '#E5E7EB'}
                  />
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Already Rated Users */}
        {ratedUsers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Already Rated</Text>
            {ratedUsers.map((user) => (
              <Card key={user.user_id} variant="elevated" style={styles.ratedUserCard}>
                <View style={styles.userHeader}>
                  <TouchableOpacity 
                    style={styles.userInfo}
                    onPress={() => router.push(`/ratings/${user.user_id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatar}>
                      {user.profile_picture_url ? (
                        <Image 
                          source={{ uri: user.profile_picture_url }} 
                          style={styles.avatarImage}
                          onError={(error) => {
                            console.warn('⚠️ User image failed to load:', error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <UserIcon size={24} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.userDetails}>
                      <View style={styles.userNameContainer}>
                        <Text style={styles.userName}>
                          {user.first_name} {user.last_name}
                        </Text>
                        {user.current_rating && user.total_reviews > 0 ? (
                          <View style={styles.currentRatingContainer}>
                            <StarIcon size={14} color={Colors.warning} />
                            <Text style={styles.currentRatingText}>
                              {user.current_rating.toFixed(1)}
                            </Text>
                            <Text style={styles.reviewCountText}>
                              ({user.total_reviews})
                            </Text>
                          </View>
                        ) : (
                          __DEV__ && (
                            <Text style={styles.reviewCountText}>
                              Debug: No ratings
                            </Text>
                          )
                        )}
                      </View>
                      <View style={[
                        styles.roleBadge,
                        user.role === 'driver' ? styles.driverBadge : styles.passengerBadge
                      ]}>
                        <Text style={[
                          styles.roleText,
                          user.role === 'driver' ? styles.driverText : styles.passengerText
                        ]}>
                          {user.role === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.ratedBadge}>
                    <CheckCircleIcon size={20} color={Colors.success} />
                    <Text style={styles.ratedText}>Rated</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Submit Button */}
        {unratedUsers.length > 0 && (
          <Button
            title={`Submit ${Object.values(userRatings).filter(r => r.rating > 0).length} Rating${Object.values(userRatings).filter(r => r.rating > 0).length !== 1 ? 's' : ''}`}
            onPress={submitRatings}
            loading={submitting}
            disabled={Object.values(userRatings).every(r => r.rating === 0)}
            style={styles.submitButton}
          />
        )}

        {/* No Users to Rate */}
        {unratedUsers.length === 0 && ratedUsers.length === 0 && (
          <Card variant="elevated" style={styles.emptyCard}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>⭐</Text>
              </View>
              <Text style={styles.emptyTitle}>No One to Rate</Text>
              <Text style={styles.emptyText}>
                There are no other participants in this ride to rate.
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
  },
  ineligibleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ineligibleIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  ineligibleTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  ineligibleText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  goBackButton: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  rideCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  rideTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  rideRoute: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  rideDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  userCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border + '20',
  },
  ratedUserCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.success + '05',
    borderRadius: BorderRadius.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: Colors.success + '20',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  driverBadge: {
    backgroundColor: Colors.primary + '15',
  },
  passengerBadge: {
    backgroundColor: Colors.success + '15',
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  driverText: {
    color: Colors.primary,
  },
  passengerText: {
    color: Colors.success,
  },
  ratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  ratedText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  ratingText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 80,
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },
  anonymousContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background || '#F8F9FA',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  anonymousInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  anonymousLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  anonymousDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  submitButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  emptyCard: {
    padding: Spacing.xl,
    marginTop: Spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  currentRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  currentRatingText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.warning,
    marginLeft: 4,
  },
  reviewCountText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
});
