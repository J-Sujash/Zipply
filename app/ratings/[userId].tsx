import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  ArrowLeftIcon,
  StarIcon,
  UserIcon,
} from '../../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  isDriverReview: boolean;
  createdAt: string;
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
  };
  ride: {
    id: string;
    title: string;
    departureLocation: string;
    destinationLocation: string;
    departureDate: string;
  };
}

interface RatingStats {
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

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  rating: number;
  totalRidesAsDriver: number;
  totalRidesAsPassenger: number;
}

const { width } = Dimensions.get('window');

export default function RatingsScreen() {
  const { user } = useAuth();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'driver' | 'passenger'>('all');
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const isOwnProfile = user?.id === userId;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchRatingsData();
    }
  }, [targetUserId, filter]);

  const fetchRatingsData = async () => {
    if (!targetUserId) return;

    try {
      setError(null);
      
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          profile_picture_url,
          rating,
          total_rides_as_driver,
          total_rides_as_passenger
        `)
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;

      setProfile({
        id: profileData.id,
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        profilePictureUrl: profileData.profile_picture_url,
        rating: profileData.rating,
        totalRidesAsDriver: profileData.total_rides_as_driver,
        totalRidesAsPassenger: profileData.total_rides_as_passenger,
      });

      // Fetch rating statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_rating_stats', { user_id: targetUserId });

      if (statsError) throw statsError;

      if (statsData && statsData.length > 0) {
        const stats = statsData[0];
        setRatingStats({
          totalReviews: stats.total_reviews,
          averageRating: stats.average_rating,
          fiveStar: stats.five_star,
          fourStar: stats.four_star,
          threeStar: stats.three_star,
          twoStar: stats.two_star,
          oneStar: stats.one_star,
          driverReviews: stats.driver_reviews,
          passengerReviews: stats.passenger_reviews,
        });
      }

      // Fetch reviews with filters
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
        .eq('reviewee_id', targetUserId)
        .order('created_at', { ascending: false });

      if (filter === 'driver') {
        query = query.eq('is_driver_review', true);
      } else if (filter === 'passenger') {
        query = query.eq('is_driver_review', false);
      }

      const { data: reviewsData, error: reviewsError } = await query;

      if (reviewsError) throw reviewsError;

      const formattedReviews: Review[] = (reviewsData || []).map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isDriverReview: review.is_driver_review,
        createdAt: review.created_at,
        reviewer: {
          id: review.reviewer?.id || '',
          firstName: review.reviewer?.first_name || 'Unknown',
          lastName: review.reviewer?.last_name || 'User',
          profilePictureUrl: review.reviewer?.profile_picture_url,
        },
        ride: {
          id: review.ride?.id || '',
          title: review.ride?.title || 'Unknown Ride',
          departureLocation: review.ride?.departure_location || 'Unknown',
          destinationLocation: review.ride?.destination_location || 'Unknown',
          departureDate: review.ride?.departure_date || '',
        },
      }));

      setReviews(formattedReviews);
    } catch (error: any) {
      console.error('Error fetching ratings data:', error);
      setError(error.message || 'Failed to load ratings data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRatingsData();
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            size={size}
            color={star <= rating ? Colors.warning : Colors.border}
            filled={star <= rating}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (stars: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <View style={styles.ratingBarContainer}>
        <Text style={styles.ratingBarLabel}>{stars}</Text>
        <StarIcon size={14} color={Colors.warning} filled />
        <View style={styles.ratingBarTrack}>
          <View 
            style={[
              styles.ratingBarFill, 
              { width: `${percentage}%` }
            ]} 
          />
        </View>
        <Text style={styles.ratingBarCount}>{count}</Text>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading ratings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Failed to load ratings data'}
          </Text>
          <Button
            title="Try Again"
            onPress={fetchRatingsData}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const filteredReviews = reviews.filter(review => {
    if (filter === 'driver') return review.isDriverReview;
    if (filter === 'passenger') return !review.isDriverReview;
    return true;
  });

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
        <Text style={styles.title}>
          {isOwnProfile ? 'My Ratings' : `${profile.firstName}'s Ratings`}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Summary */}
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity 
                style={styles.avatar}
                onPress={() => {
                  if (profile.profilePictureUrl) {
                    setShowImageModal(true);
                  }
                }}
                activeOpacity={profile.profilePictureUrl ? 0.7 : 1}
              >
                {profile.profilePictureUrl ? (
                  <Image 
                    source={{ uri: profile.profilePictureUrl }} 
                    style={styles.avatarImage}
                    onError={(error) => {
                      console.warn('⚠️ Profile image failed to load:', error.nativeEvent.error);
                      // Clear the broken URL from state to show fallback
                      setProfile(prev => prev ? { ...prev, profilePictureUrl: undefined } : null);
                    }}
                  />
                ) : (
                  <UserIcon size={40} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile.firstName} {profile.lastName}
              </Text>
              <View style={styles.ratingRow}>
                {renderStars(Math.round(profile.rating), 20)}
                <Text style={styles.ratingText}>
                  {profile.rating.toFixed(1)} ({ratingStats?.totalReviews || 0} reviews)
                </Text>
              </View>
              <Text style={styles.ridesText}>
                {profile.totalRidesAsDriver} rides as driver • {profile.totalRidesAsPassenger} as passenger
              </Text>
            </View>
          </View>
        </Card>

        {/* Rating Statistics */}
        {ratingStats && ratingStats.totalReviews > 0 && (
          <Card variant="elevated" style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Rating Breakdown</Text>
            <View style={styles.statsContainer}>
              {renderRatingBar(5, ratingStats.fiveStar, ratingStats.totalReviews)}
              {renderRatingBar(4, ratingStats.fourStar, ratingStats.totalReviews)}
              {renderRatingBar(3, ratingStats.threeStar, ratingStats.totalReviews)}
              {renderRatingBar(2, ratingStats.twoStar, ratingStats.totalReviews)}
              {renderRatingBar(1, ratingStats.oneStar, ratingStats.totalReviews)}
            </View>
          </Card>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <View style={styles.filterWrapper}>
            {[
              { key: 'all', label: 'All Reviews', count: ratingStats?.totalReviews || 0 },
              { key: 'driver', label: 'As Driver', count: ratingStats?.driverReviews || 0 },
              { key: 'passenger', label: 'As Passenger', count: ratingStats?.passengerReviews || 0 },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterButton,
                  filter === tab.key && styles.activeFilterButton,
                ]}
                onPress={() => setFilter(tab.key as any)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === tab.key && styles.activeFilterButtonText,
                  ]}
                >
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reviews List */}
        {filteredReviews.length > 0 ? (
          <View style={styles.reviewsContainer}>
            {filteredReviews.map((review) => (
              <Card key={review.id} variant="elevated" style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      {review.reviewer.profilePictureUrl ? (
                        <Image 
                          source={{ uri: review.reviewer.profilePictureUrl }} 
                          style={styles.reviewerAvatarImage}
                          onError={(error) => {
                            console.warn('⚠️ Reviewer image failed to load:', error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <UserIcon size={20} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.reviewerDetails}>
                      <Text style={styles.reviewerName}>
                        {review.reviewer.firstName} {review.reviewer.lastName}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {formatDate(review.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.reviewRating}>
                    {renderStars(review.rating, 14)}
                    <View style={[
                      styles.roleBadge,
                      review.isDriverReview ? styles.driverBadge : styles.passengerBadge
                    ]}>
                      <Text style={[
                        styles.roleText,
                        review.isDriverReview ? styles.driverText : styles.passengerText
                      ]}>
                        {review.isDriverReview ? '🚗 Driver' : '🎒 Passenger'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
                
                <View style={styles.rideInfo}>
                  <Text style={styles.rideTitle}>{review.ride.title}</Text>
                  <Text style={styles.rideRoute}>
                    {review.ride.departureLocation} → {review.ride.destinationLocation}
                  </Text>
                  <Text style={styles.rideDate}>
                    {formatDate(review.ride.departureDate)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card variant="elevated" style={styles.emptyCard}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>⭐</Text>
              </View>
              <Text style={styles.emptyTitle}>No Reviews Yet</Text>
              <Text style={styles.emptyText}>
                {filter === 'all' 
                  ? `${isOwnProfile ? 'You haven\'t' : `${profile.firstName} hasn't`} received any reviews yet.`
                  : `No reviews as ${filter === 'driver' ? 'driver' : 'passenger'} yet.`
                }
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Profile Picture Expanded Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.expandedImageContainer}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              {profile?.profilePictureUrl ? (
                <Image 
                  source={{ uri: profile.profilePictureUrl }} 
                  style={styles.expandedImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.expandedPlaceholder}>
                  <UserIcon size={80} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.closeModalText}>✕</Text>
            </TouchableOpacity>
            
            {/* User name below image */}
            <Text style={styles.expandedImageName}>
              {profile?.firstName} {profile?.lastName}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
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
  profileCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: Spacing.sm,
  },
  ratingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  ridesText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statsContainer: {
    gap: Spacing.sm,
  },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingBarLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    width: 12,
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: Colors.warning,
  },
  ratingBarCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 24,
    textAlign: 'right',
  },
  filterContainer: {
    marginBottom: Spacing.lg,
  },
  filterWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 1,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 36,
  },
  activeFilterButton: {
    backgroundColor: Colors.white,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonText: {
    fontSize: FontSize.xs,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  activeFilterButtonText: {
    color: Colors.primary,
  },
  reviewsContainer: {
    gap: Spacing.md,
  },
  reviewCard: {
    padding: Spacing.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  reviewerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  reviewRating: {
    alignItems: 'flex-end',
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
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
  reviewComment: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  rideInfo: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rideTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  rideRoute: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  rideDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  emptyCard: {
    padding: Spacing.xl,
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
  // Modal styles for expanded profile picture
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  expandedImageContainer: {
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    borderRadius: (Dimensions.get('window').width * 0.8) / 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
  expandedPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 60,
    right: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  expandedImageName: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
});
