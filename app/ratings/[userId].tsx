import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { reviewService } from '../../lib/reviewService';
import { getSimpleRideStats } from '../../lib/rideStats';
import { supabase } from '../../lib/supabase';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
    ArrowLeftIcon,
    SchoolIcon,
    StarIcon,
    UserIcon
} from '../../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';

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
  university?: string;
  graduationYear?: number;
  degree?: string;
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
  const [rideStats, setRideStats] = useState({ totalRidesAsDriver: 0, totalRidesAsPassenger: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  const isOwnProfile = user?.id === userId;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchRatingsData();
      fetchRideStatistics();
    }
  }, [targetUserId, filter]);

  const fetchRideStatistics = async () => {
    if (!targetUserId) return;

    try {
      setLoadingStats(true);
      console.log('📊 Fetching ride statistics for user:', targetUserId);
      const stats = await getSimpleRideStats(targetUserId);
      setRideStats(stats);
      console.log('✅ Ride statistics updated:', stats);
    } catch (error) {
      console.error('❌ Error fetching ride statistics:', error);
      // Keep default values on error
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchRatingsData = async () => {
    if (!targetUserId) return;

    try {
      setError(null);
      console.log('🔄 Fetching profile data directly from database for user:', targetUserId);
      
      // Fetch user profile directly from database
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          profile_picture_url,
          rating,
          total_rides_as_driver,
          total_rides_as_passenger,
          school,
          grad_year,
          degree
        `)
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;
      console.log('✅ Profile data received from database:', profileData);

      setProfile({
        id: profileData.id,
        firstName: profileData.first_name || 'Unknown',
        lastName: profileData.last_name || 'User',
        profilePictureUrl: profileData.profile_picture_url,
        rating: profileData.rating || 0,
        totalRidesAsDriver: rideStats.totalRidesAsDriver,
        totalRidesAsPassenger: rideStats.totalRidesAsPassenger,
        university: profileData.school,
        graduationYear: profileData.grad_year,
        degree: profileData.degree,
      });

      // Fetch rating statistics directly from database
      console.log('🔄 Fetching rating stats directly from database...');
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating, is_driver_review')
        .eq('reviewee_id', targetUserId);

      if (reviewsError) {
        console.warn('⚠️ Could not fetch reviews:', reviewsError);
      }

      // Calculate rating statistics
      const reviews = reviewsData || [];
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
        : profileData.rating || 0;

      const ratingCounts = [0, 0, 0, 0, 0]; // [1-star, 2-star, 3-star, 4-star, 5-star]
      reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
          ratingCounts[review.rating - 1]++;
        }
      });

      const driverReviews = reviews.filter(r => r.is_driver_review).length;
      const passengerReviews = reviews.filter(r => !r.is_driver_review).length;

      setRatingStats({
        totalReviews,
        averageRating,
        oneStar: ratingCounts[0],
        twoStar: ratingCounts[1],
        threeStar: ratingCounts[2],
        fourStar: ratingCounts[3],
        fiveStar: ratingCounts[4],
        driverReviews,
        passengerReviews,
      });

      console.log('✅ Rating stats calculated:', {
        totalReviews,
        averageRating: averageRating.toFixed(1),
        driverReviews,
        passengerReviews
      });

      // Fetch actual reviews using reviewService (respects anonymity)
      console.log('🔄 Fetching reviews with anonymity support...');
      try {
        const reviewsData = await reviewService.getUserReviews(targetUserId);
        console.log('✅ Reviews fetched:', reviewsData.length);
        
        // Transform reviews to match our interface
        const transformedReviews: Review[] = reviewsData.map(review => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          isDriverReview: review.is_driver_review,
          createdAt: review.created_at,
          reviewer: {
            id: review.reviewer?.id || 'anonymous',
            firstName: review.reviewer?.first_name || 'Anonymous',
            lastName: review.reviewer?.last_name || 'User',
            profilePictureUrl: review.reviewer?.profile_picture_url,
          },
          ride: {
            id: review.ride?.id || '',
            title: review.ride?.title || 'Unknown Ride',
            departureLocation: review.ride?.departure_location || 'Unknown',
            destinationLocation: review.ride?.destination_location || 'Unknown',
            departureDate: review.ride?.departure_date || new Date().toISOString(),
          },
        }));
        
        setReviews(transformedReviews);
      } catch (reviewError) {
        console.warn('⚠️ Could not fetch reviews:', reviewError);
        setReviews([]);
      }
      
      console.log('✅ Profile data loaded successfully');
      
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
    fetchRideStatistics();
  };

  // Update profile when ride stats change
  useEffect(() => {
    if (profile && (rideStats.totalRidesAsDriver !== profile.totalRidesAsDriver || 
                   rideStats.totalRidesAsPassenger !== profile.totalRidesAsPassenger)) {
      setProfile(prev => prev ? {
        ...prev,
        totalRidesAsDriver: rideStats.totalRidesAsDriver,
        totalRidesAsPassenger: rideStats.totalRidesAsPassenger,
      } : null);
    }
  }, [rideStats, profile]);

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

  const renderModernRatingBar = (stars: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <View style={styles.modernRatingBarContainer}>
        <View style={styles.ratingBarLeft}>
          <Text style={styles.modernRatingBarLabel}>{stars}</Text>
          <StarIcon size={16} color="#FFD700" filled />
        </View>
        
        <View style={styles.modernRatingBarTrack}>
          <View 
            style={[
              styles.modernRatingBarFill, 
              { 
                width: `${percentage}%`,
                backgroundColor: stars >= 4 ? '#10B981' : stars >= 3 ? '#F59E0B' : '#EF4444'
              }
            ]} 
          />
        </View>
        
        <View style={styles.ratingBarRight}>
          <Text style={styles.modernRatingBarCount}>{count}</Text>
          <Text style={styles.modernRatingBarPercentage}>
            {total > 0 ? Math.round(percentage) : 0}%
          </Text>
        </View>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDegree = (degree?: string) => {
    if (!degree) return '';
    switch (degree.toLowerCase()) {
      case 'bachelor':
        return 'Bachelor\'s';
      case 'masters':
        return 'Master\'s';
      case 'phd':
        return 'PhD';
      default:
        return degree;
    }
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
        {/* Modern Profile Summary */}
        <Card variant="elevated" style={styles.modernProfileCard}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Profile Picture */}
            <View style={styles.avatarSection}>
              <TouchableOpacity 
                style={styles.modernAvatar}
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
                    style={styles.modernAvatarImage}
                    onError={(error) => {
                      console.warn('⚠️ Profile image failed to load:', error.nativeEvent.error);
                      setProfile(prev => prev ? { ...prev, profilePictureUrl: undefined } : null);
                    }}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <UserIcon size={40} color={Colors.white} />
                  </View>
                )}
                <View style={styles.statusIndicator} />
              </TouchableOpacity>
            </View>
            
            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <Text style={styles.modernProfileName}>
                {profile.firstName} {profile.lastName}
              </Text>
              
              {/* Star Rating */}
              <View style={styles.modernRatingRow}>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View key={star} style={styles.starIcon}>
                      <StarIcon
                        size={18}
                        color={star <= Math.round(profile.rating) ? '#FFD700' : '#E5E7EB'}
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.modernRatingText}>
                  {profile.rating.toFixed(1)} ({ratingStats?.totalReviews || 0})
                </Text>
              </View>
            </View>
          </View>

          {/* Enhanced Stats Section */}
          <View style={styles.enhancedStatsSection}>
            <Text style={styles.statsTitle}>Ride History</Text>
            {loadingStats ? (
              <View style={styles.statsLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.statsLoadingText}>Loading statistics...</Text>
              </View>
            ) : (
              <View style={styles.modernStatsGrid}>
                <View style={styles.modernStatCard}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.statEmoji}>🚗</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.modernStatNumber}>{profile.totalRidesAsDriver}</Text>
                    <Text style={styles.modernStatLabel}>As Driver</Text>
                  </View>
                  <View style={styles.statIndicator} />
                </View>
                
                <View style={styles.modernStatCard}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.statEmoji}>🎒</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.modernStatNumber}>{profile.totalRidesAsPassenger}</Text>
                    <Text style={styles.modernStatLabel}>As Passenger</Text>
                  </View>
                  <View style={styles.statIndicator} />
                </View>
              </View>
            )}
          </View>

          {/* Education Section */}
          {(profile.university || profile.degree || profile.graduationYear) && (
            <View style={styles.educationSection}>
              <View style={styles.sectionHeader}>
                <SchoolIcon size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Education</Text>
              </View>
              
              <View style={styles.educationContent}>
                {profile.university && (
                  <Text style={styles.universityName}>{profile.university}</Text>
                )}
                
                {(profile.degree || profile.graduationYear) && (
                  <Text style={styles.degreeText}>
                    {profile.degree && profile.degree}
                    {profile.degree && profile.graduationYear && ' • '}
                    {profile.graduationYear && `Class of ${profile.graduationYear}`}
                  </Text>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* Rating Statistics */}
        {ratingStats && ratingStats.totalReviews > 0 && (
          <Card variant="elevated" style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Rating Breakdown</Text>
            <View style={styles.modernStatsContainer}>
              {renderModernRatingBar(5, ratingStats.fiveStar, ratingStats.totalReviews)}
              {renderModernRatingBar(4, ratingStats.fourStar, ratingStats.totalReviews)}
              {renderModernRatingBar(3, ratingStats.threeStar, ratingStats.totalReviews)}
              {renderModernRatingBar(2, ratingStats.twoStar, ratingStats.totalReviews)}
              {renderModernRatingBar(1, ratingStats.oneStar, ratingStats.totalReviews)}
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
    backgroundColor: Colors.white,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  profileMainInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  ridesSection: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: Colors.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
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
  universitySection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: Spacing.sm,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  universityText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  universityName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  degreeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statsCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border + '15',
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
  // Modern Rating Bar Styles
  modernStatsContainer: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modernRatingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  ratingBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 50,
    gap: 4,
  },
  modernRatingBarLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    width: 16,
  },
  modernRatingBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: Spacing.md,
  },
  modernRatingBarFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 2,
  },
  ratingBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  modernRatingBarCount: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 20,
    textAlign: 'right',
  },
  modernRatingBarPercentage: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },
  filterContainer: {
    marginBottom: Spacing.lg,
  },
  filterWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 4,
    gap: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: Colors.border + '30',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border + '20',
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
  // Modern Profile Card Styles
  modernProfileCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  modernAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    position: 'relative',
  },
  modernAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  modernProfileName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  modernRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  starIcon: {
    marginRight: 2,
  },
  modernRatingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rideStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: Spacing.md,
  },
  modernUniversitySection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  universityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  universitySectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  // New responsive layout styles
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarSection: {
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  statsSection: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  educationSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  educationSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  educationContent: {
    gap: Spacing.xs,
  },
  // Enhanced Modern Statistics Styles
  enhancedStatsSection: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'left',
  },
  statsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  statsLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modernStatsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modernStatCard: {
    flex: 1,
    backgroundColor: '#FAFBFC',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E8F4FD',
    position: 'relative',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statEmoji: {
    fontSize: 16,
  },
  statContent: {
    alignItems: 'flex-start',
  },
  modernStatNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 2,
    lineHeight: FontSize.xxl + 4,
  },
  modernStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 3,
    height: '100%',
    backgroundColor: Colors.primary,
    borderTopRightRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
});
