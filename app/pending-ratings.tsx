import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { reviewService } from '../lib/reviewService';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  ArrowLeftIcon,
  StarIcon,
  ClockIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  UserIcon,
} from '../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors';

interface EligibleRide {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  unratedCount: number;
}

interface EditableReview {
  id: string;
  rating: number;
  comment?: string;
  is_driver_review: boolean;
  is_anonymous: boolean;
  created_at: string;
  reviewee: {
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
  ride: {
    id: string;
    title: string;
    departure_date: string;
    departure_time: string;
  };
}

export default function PendingRatingsScreen() {
  const { user } = useAuth();
  const [eligibleRides, setEligibleRides] = useState<EligibleRide[]>([]);
  const [editableReviews, setEditableReviews] = useState<EditableReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingReview, setEditingReview] = useState<EditableReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [editAnonymous, setEditAnonymous] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchEligibleRides();
    }
  }, [user?.id]);

  const fetchEligibleRides = async () => {
    if (!user?.id) return;

    try {
      setError(null);
      
      // Fetch eligible rides to rate
      const rides = await reviewService.getEligibleRides(user.id);
      const formattedRides = rides.map(ride => ({
        ...ride,
        unratedCount: 1 // Default to 1 for now, could be calculated based on participants
      }));
      setEligibleRides(formattedRides);

      // Fetch editable reviews (within 48 hours)
      const editableReviews = await reviewService.getEditableReviews(user.id);
      setEditableReviews(editableReviews);
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      
      // Handle server connection errors gracefully
      let errorMessage = 'Failed to load data';
      if (error.message.includes('server') || error.message.includes('Network')) {
        errorMessage = 'Server is not available. The rating endpoints need to be added to your Python server.';
      } else {
        errorMessage = error.message || 'Failed to load data';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEligibleRides();
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  const getTimeRemaining = (dateString: string, timeString: string) => {
    const rideDateTime = new Date(`${dateString}T${timeString}`);
    const expiryTime = new Date(rideDateTime.getTime() + 48 * 60 * 60 * 1000);
    const now = new Date();
    const timeLeft = expiryTime.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m left`;
    } else {
      return `${minutesLeft}m left`;
    }
  };

  const getReviewTimeRemaining = (createdAt: string) => {
    const reviewDate = new Date(createdAt);
    const expiryTime = new Date(reviewDate.getTime() + 48 * 60 * 60 * 1000);
    const now = new Date();
    const timeLeft = expiryTime.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m left to edit`;
    } else {
      return `${minutesLeft}m left to edit`;
    }
  };

  const handleEditReview = (review: EditableReview) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
    setEditAnonymous(review.is_anonymous);
    setEditModalVisible(true);
  };

  const handleUpdateReview = async () => {
    if (!editingReview || !user?.id) return;

    try {
      setUpdating(true);
      
      await reviewService.updateReview(editingReview.id, {
        rating: editRating,
        comment: editComment.trim() || undefined,
        is_anonymous: editAnonymous,
      });

      Alert.alert('Success', 'Review updated successfully!');
      setEditModalVisible(false);
      fetchEligibleRides(); // Refresh data
      
    } catch (error: any) {
      console.error('Error updating review:', error);
      Alert.alert('Error', error.message || 'Failed to update review');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteReview = (review: EditableReview) => {
    Alert.alert(
      'Delete Review',
      `Are you sure you want to delete your review for ${review.reviewee.first_name} ${review.reviewee.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await reviewService.deleteReview(review.id, user?.id || '');
              Alert.alert('Success', 'Review deleted successfully!');
              fetchEligibleRides(); // Refresh data
            } catch (error: any) {
              console.error('Error deleting review:', error);
              Alert.alert('Error', error.message || 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const renderStars = (rating: number, onPress?: (star: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress?.(star)}
            style={styles.starButton}
            disabled={!onPress}
          >
            <StarIcon
              size={24}
              color={star <= rating ? Colors.warning : Colors.border}
              filled={star <= rating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading pending ratings...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.title}>Pending Ratings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <Card variant="elevated" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Try Again"
              onPress={fetchEligibleRides}
              style={styles.retryButton}
            />
          </Card>
        )}

        {/* Editable Reviews Section */}
        {editableReviews.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Recent Reviews</Text>
            <Text style={styles.description}>
              You can edit or delete these reviews within 48 hours of submission.
            </Text>
            
            {editableReviews.map((review) => (
              <Card key={review.id} variant="elevated" style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      {review.reviewee.profile_picture_url ? (
                        <Image 
                          source={{ uri: review.reviewee.profile_picture_url }} 
                          style={styles.reviewerAvatarImage}
                          onError={(error) => {
                            console.warn('⚠️ Reviewee image failed to load:', error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <UserIcon size={20} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.reviewerDetails}>
                      <Text style={styles.reviewerName}>
                        {review.reviewee.first_name} {review.reviewee.last_name}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {formatDate(review.created_at)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.reviewActions}>
                    <TouchableOpacity
                      onPress={() => handleEditReview(review)}
                      style={styles.actionButton}
                    >
                      <EditIcon size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteReview(review)}
                      style={styles.actionButton}
                    >
                      <TrashIcon size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.reviewContent}>
                  {renderStars(review.rating)}
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                  
                  {/* Ride Details */}
                  <View style={styles.rideDetailsContainer}>
                    <Text style={styles.rideDetailsTitle}>Ride Details:</Text>
                    <Text style={styles.rideDetailsRoute}>
                      {review.ride.title}
                    </Text>
                    <Text style={styles.rideDetailsText}>
                      {formatDate(review.ride.departure_date)} at {formatTime(review.ride.departure_time)}
                    </Text>
                  </View>
                  
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewType}>
                      {review.is_driver_review ? '🚗 Driver Review' : '🎒 Passenger Review'}
                    </Text>
                    {review.is_anonymous && (
                      <Text style={styles.anonymousLabel}>Anonymous</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.timeRemaining}>
                  <ClockIcon size={14} color={Colors.warning} />
                  <Text style={styles.timeRemainingText}>
                    {getReviewTimeRemaining(review.created_at)}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Eligible Rides Section */}
        {eligibleRides.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Rides to Rate</Text>
            <Text style={styles.description}>
              Rate your fellow travelers within 48 hours of ride completion.
            </Text>
            
            {eligibleRides.map((ride) => (
              <Card key={ride.id} variant="elevated" style={styles.rideCard}>
                <View style={styles.rideHeader}>
                  <Text style={styles.rideTitle}>{ride.title}</Text>
                  <View style={styles.timeRemaining}>
                    <ClockIcon size={14} color={Colors.warning} />
                    <Text style={styles.timeRemainingText}>
                      {getTimeRemaining(ride.departure_date, ride.departure_time)}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.rideRoute}>
                  {ride.departure_location} → {ride.destination_location}
                </Text>
                
                <Text style={styles.rideDate}>
                  {formatDate(ride.departure_date)} at {formatTime(ride.departure_time)}
                </Text>
                
                <View style={styles.rideFooter}>
                  <View style={styles.unratedInfo}>
                    <UsersIcon size={16} color={Colors.primary} />
                    <Text style={styles.unratedText}>
                      {ride.unratedCount} {ride.unratedCount === 1 ? 'person' : 'people'} to rate
                    </Text>
                  </View>
                  
                  <Button
                    title="Rate Now"
                    onPress={() => router.push(`/rate-ride/${ride.id}` as any)}
                    style={styles.rateButton}
                    textStyle={styles.rateButtonText}
                  />
                </View>
              </Card>
            ))}
          </>
        ) : (
          eligibleRides.length === 0 && editableReviews.length === 0 && (
            <Card variant="elevated" style={styles.emptyCard}>
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <StarIcon size={48} color={Colors.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No Pending Ratings</Text>
                <Text style={styles.emptyText}>
                  You don't have any completed rides that need ratings right now.
                  Ratings are available for 48 hours after ride completion.
                </Text>
              </View>
            </Card>
          )
        )}
      </ScrollView>

      {/* Edit Review Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Review</Text>
            
            {/* Reviewee Info */}
            {editingReview && (
              <View style={styles.modalRevieweeInfo}>
                <View style={styles.modalRevieweeAvatar}>
                  {editingReview.reviewee.profile_picture_url ? (
                    <Image 
                      source={{ uri: editingReview.reviewee.profile_picture_url }} 
                      style={styles.modalRevieweeAvatarImage}
                      onError={(error) => {
                        console.warn('⚠️ Modal reviewee image failed to load:', error.nativeEvent.error);
                      }}
                    />
                  ) : (
                    <UserIcon size={24} color={Colors.white} />
                  )}
                </View>
                <View style={styles.modalRevieweeDetails}>
                  <Text style={styles.modalRevieweeName}>
                    {editingReview.reviewee.first_name} {editingReview.reviewee.last_name}
                  </Text>
                  <Text style={styles.modalRideRoute}>
                    {editingReview.ride.title}
                  </Text>
                  <Text style={styles.modalRideDetails}>
                    {formatDate(editingReview.ride.departure_date)} at {formatTime(editingReview.ride.departure_time)}
                  </Text>
                </View>
              </View>
            )}

            {renderStars(editRating, setEditRating)}
            
            <TextInput
              style={styles.modalCommentInput}
              placeholder="Add a comment (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={editComment}
              onChangeText={setEditComment}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <View style={styles.modalAnonymousContainer}>
              <View style={styles.modalAnonymousInfo}>
                <Text style={styles.modalAnonymousLabel}>Submit anonymously</Text>
                <Text style={styles.modalAnonymousDescription}>
                  Your name and profile won't be shown with this review
                </Text>
              </View>
              <Switch
                value={editAnonymous}
                onValueChange={setEditAnonymous}
                trackColor={{ 
                  false: Colors.border || '#E5E7EB', 
                  true: Colors.primary || '#3B82F6' 
                }}
                thumbColor={editAnonymous ? Colors.white || '#FFFFFF' : Colors.textSecondary || '#6B7280'}
                ios_backgroundColor={Colors.border || '#E5E7EB'}
              />
            </View>

            <View style={styles.modalButtonContainer}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
                style={styles.modalCancelButton}
              />
              <Button
                title="Update Review"
                onPress={handleUpdateReview}
                loading={updating}
                disabled={editRating === 0}
                style={styles.modalUpdateButton}
              />
            </View>
          </View>
        </View>
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
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  errorCard: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.error + '10',
    borderWidth: 1,
    borderColor: Colors.error + '20',
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
  },
  rideCard: {
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
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  rideTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  timeRemainingText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.warning,
  },
  rideRoute: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  rideDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unratedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  unratedText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  rateButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rateButtonText: {
    fontSize: FontSize.sm,
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
  // Review styles
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  reviewCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  reviewContent: {
    marginBottom: Spacing.md,
  },
  reviewComment: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  rideDetailsContainer: {
    backgroundColor: Colors.background || '#F8F9FA',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rideDetailsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  rideDetailsRoute: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  rideDetailsText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  reviewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  reviewType: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  anonymousLabel: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontWeight: '600',
  },
  // Star rating styles
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalCommentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 80,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalAnonymousContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background || '#F8F9FA',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  modalAnonymousInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  modalAnonymousLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  modalAnonymousDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalUpdateButton: {
    flex: 1,
  },
  // Modal reviewee info styles
  modalRevieweeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background || '#F8F9FA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modalRevieweeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  modalRevieweeAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  modalRevieweeDetails: {
    flex: 1,
  },
  modalRevieweeName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  modalRideRoute: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  modalRideDetails: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
