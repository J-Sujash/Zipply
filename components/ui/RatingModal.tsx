import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from './Button';
import { StarIcon } from './Icons';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  revieweeId: string;
  revieweeName: string;
  isDriverReview: boolean;
  onSubmitted?: () => void;
}

export function RatingModal({
  visible,
  onClose,
  rideId,
  revieweeId,
  revieweeName,
  isDriverReview,
  onSubmitted,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('reviews')
        .insert({
          ride_id: rideId,
          reviewee_id: revieweeId,
          rating,
          comment: comment.trim() || null,
          is_driver_review: isDriverReview,
        });

      if (error) throw error;

      Alert.alert('Success', 'Thank you for your rating!');
      onSubmitted?.();
      handleClose();
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', error.message || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <StarIcon
              size={32}
              color={star <= rating ? Colors.warning : Colors.border}
              filled={star <= rating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Tap to rate';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            Rate {revieweeName}
          </Text>
          <Text style={styles.subtitle}>
            How was your experience as a {isDriverReview ? 'passenger' : 'driver'}?
          </Text>

          {renderStars()}
          
          <Text style={styles.ratingText}>{getRatingText()}</Text>

          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional)"
            placeholderTextColor={Colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={handleClose}
              variant="outline"
              style={styles.cancelButton}
            />
            <Button
              title="Submit Rating"
              onPress={handleSubmit}
              loading={submitting}
              disabled={rating === 0}
              style={styles.submitButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  starButton: {
    padding: Spacing.sm,
  },
  ratingText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: Spacing.xl,
    minHeight: 80,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
});
