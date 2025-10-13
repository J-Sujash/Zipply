import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ride } from '../../lib/supabase';
import { updateRide, UpdateRideData, canEditRide } from '../../lib/rideManagement';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import {
  LocationIcon,
  TimeIcon,
  CalendarIcon,
  UserIcon,
  XIcon,
  CheckIcon,
} from '../ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';

interface EditRideModalProps {
  visible: boolean;
  ride: Ride | null;
  onClose: () => void;
  onSuccess: (updatedRide: Ride) => void;
}

export const EditRideModal: React.FC<EditRideModalProps> = ({
  visible,
  ride,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    totalSeats: '1',
    price: '',
    description: '',
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(true);
  const [checkingEditability, setCheckingEditability] = useState(false);

  // Initialize form data when ride changes
  useEffect(() => {
    if (ride && visible) {
      setFormData({
        from: ride.departure_location,
        to: ride.destination_location,
        totalSeats: ride.total_seats.toString(),
        price: ride.price_per_seat.toString(),
        description: ride.description || '',
      });

      // Parse date and time
      const rideDate = new Date(ride.departure_date);
      const [hours, minutes] = ride.departure_time.split(':');
      const rideTime = new Date();
      rideTime.setHours(parseInt(hours), parseInt(minutes));

      setSelectedDate(rideDate);
      setSelectedTime(rideTime);
      setErrors({});

      // Check if ride can be edited
      checkEditability();
    }
  }, [ride, visible]);

  const checkEditability = async () => {
    if (!ride) return;
    
    setCheckingEditability(true);
    try {
      const editable = await canEditRide(ride.id);
      setCanEdit(editable);
    } catch (error) {
      console.error('Error checking editability:', error);
      setCanEdit(false);
    } finally {
      setCheckingEditability(false);
    }
  };

  const seatOptions = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.from.trim()) {
      newErrors.from = 'Departure location is required';
    }

    if (!formData.to.trim()) {
      newErrors.to = 'Destination is required';
    }

    // Date validation
    const now = new Date();
    if (selectedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      newErrors.date = 'Date cannot be in the past';
    }

    if (!formData.totalSeats.trim()) {
      newErrors.totalSeats = 'Number of seats is required';
    }

    if (!formData.price.trim()) {
      newErrors.price = 'Price per seat is required';
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      newErrors.price = 'Please enter a valid price';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !ride) return;

    setLoading(true);
    try {
      // Format date and time for database
      const departureDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const departureTime = selectedTime.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      const updateData: UpdateRideData = {
        title: `${formData.from} to ${formData.to}`,
        departure_location: formData.from.trim(),
        destination_location: formData.to.trim(),
        departure_date: departureDate,
        departure_time: departureTime,
        total_seats: parseInt(formData.totalSeats),
        price_per_seat: parseFloat(formData.price),
        description: formData.description.trim() || undefined,
      };

      // Calculate available seats (passenger capacity = total_seats - 1 for driver)
      const currentBookedSeats = (ride.total_seats - 1) - ride.available_seats;
      const newPassengerCapacity = parseInt(formData.totalSeats) - 1; // Reserve 1 seat for driver
      const newAvailableSeats = Math.max(0, newPassengerCapacity - currentBookedSeats);
      
      updateData.available_seats = newAvailableSeats;

      const updatedRide = await updateRide(ride.id, updateData);
      
      Alert.alert(
        'Success! ✅',
        'Your ride has been updated successfully.',
        [{ text: 'OK', onPress: () => onSuccess(updatedRide) }]
      );
    } catch (error: any) {
      console.error('Error updating ride:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update ride. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date && event.type !== 'dismissed') {
      setSelectedDate(date);
      if (errors.date) {
        setErrors(prev => ({ ...prev, date: '' }));
      }
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (time && event.type !== 'dismissed') {
      setSelectedTime(time);
      if (errors.time) {
        setErrors(prev => ({ ...prev, time: '' }));
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!ride) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Edit Ride</Text>
            <Text style={styles.subtitle}>Update your ride details</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <XIcon size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {checkingEditability ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Checking ride status...</Text>
          </View>
        ) : !canEdit ? (
          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>⚠️ Cannot Edit Ride</Text>
            <Text style={styles.warningText}>
              This ride cannot be edited because passengers have already been approved. 
              Contact your passengers directly if you need to make changes.
            </Text>
            <Button
              title="Close"
              onPress={onClose}
              variant="outline"
              style={styles.warningButton}
            />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Card variant="elevated" style={styles.formCard}>
                <Text style={styles.sectionTitle}>Route Details</Text>
                
                <Input
                  label="From"
                  placeholder="Departure location"
                  value={formData.from}
                  onChangeText={(value) => updateFormData('from', value)}
                  leftIcon={<LocationIcon size={20} color={Colors.primary} />}
                  error={errors.from}
                  required
                />

                <Input
                  label="To"
                  placeholder="Destination"
                  value={formData.to}
                  onChangeText={(value) => updateFormData('to', value)}
                  leftIcon={<LocationIcon size={20} color={Colors.accent} />}
                  error={errors.to}
                  required
                />
              </Card>

              <Card variant="elevated" style={styles.formCard}>
                <Text style={styles.sectionTitle}>Schedule</Text>
                
                <View style={styles.dateTimeRow}>
                  <View style={styles.dateInput}>
                    <Text style={styles.inputLabel}>
                      Date <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dateTimeSelector,
                        errors.date && styles.dateTimeSelectorError
                      ]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <CalendarIcon size={20} color={Colors.textSecondary} />
                      <Text style={styles.dateTimeText}>
                        {formatDate(selectedDate)}
                      </Text>
                    </TouchableOpacity>
                    {errors.date && (
                      <Text style={styles.errorText}>{errors.date}</Text>
                    )}
                  </View>

                  <View style={styles.timeInput}>
                    <Text style={styles.inputLabel}>
                      Time <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dateTimeSelector,
                        errors.time && styles.dateTimeSelectorError
                      ]}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <TimeIcon size={20} color={Colors.textSecondary} />
                      <Text style={styles.dateTimeText}>
                        {formatTime(selectedTime)}
                      </Text>
                    </TouchableOpacity>
                    {errors.time && (
                      <Text style={styles.errorText}>{errors.time}</Text>
                    )}
                  </View>
                </View>

                {/* Date Picker */}
                {showDatePicker && (
                  <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'compact' : 'default'}
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                      themeVariant="light"
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.iosPickerDone}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.iosPickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Time Picker */}
                {showTimePicker && (
                  <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'compact' : 'default'}
                      onChange={handleTimeChange}
                      style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                      themeVariant="light"
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.iosPickerDone}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.iosPickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Card>

              <Card variant="elevated" style={styles.formCard}>
                <Text style={styles.sectionTitle}>Ride Details</Text>

                <View style={styles.seatsSection}>
                  <Text style={styles.label}>
                    Total Seats <Text style={styles.required}>*</Text>
                  </Text>
                  <Text style={styles.seatsNote}>
                    Currently booked: {(ride.total_seats - 1) - ride.available_seats} seats
                  </Text>
                  <View style={styles.seatsContainer}>
                    {seatOptions.map((seat) => (
                      <TouchableOpacity
                        key={seat}
                        style={[
                          styles.seatOption,
                          formData.totalSeats === seat && styles.seatOptionActive,
                          parseInt(seat) < ((ride.total_seats - 1) - ride.available_seats + 1) && styles.seatOptionDisabled,
                        ]}
                        onPress={() => updateFormData('totalSeats', seat)}
                        disabled={parseInt(seat) < ((ride.total_seats - 1) - ride.available_seats + 1)}
                      >
                        <Text
                          style={[
                            styles.seatText,
                            formData.totalSeats === seat && styles.seatTextActive,
                            parseInt(seat) < ((ride.total_seats - 1) - ride.available_seats + 1) && styles.seatTextDisabled,
                          ]}
                        >
                          {seat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.totalSeats && (
                    <Text style={styles.errorText}>{errors.totalSeats}</Text>
                  )}
                </View>

                <Input
                  label="Price per Seat"
                  placeholder="Enter price in USD"
                  value={formData.price}
                  onChangeText={(value) => updateFormData('price', value)}
                  keyboardType="numeric"
                  leftIcon={<Text style={styles.dollarSign}>$</Text>}
                  error={errors.price}
                  required
                />

                <Input
                  label="Description (Optional)"
                  placeholder="Add any additional details about your ride..."
                  value={formData.description}
                  onChangeText={(value) => updateFormData('description', value)}
                  multiline
                  numberOfLines={3}
                  style={styles.descriptionInput}
                />
              </Card>

              <View style={styles.actionButtons}>
                <Button
                  title="Cancel"
                  onPress={onClose}
                  variant="outline"
                  style={styles.cancelButton}
                />
                <Button
                  title="Save Changes"
                  onPress={handleSave}
                  loading={loading}
                  style={styles.saveButton}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  warningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  warningTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  warningText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  warningButton: {
    minWidth: 120,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateInput: {
    flex: 1,
  },
  timeInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  dateTimeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    minHeight: 48,
  },
  dateTimeSelectorError: {
    borderColor: Colors.error,
  },
  dateTimeText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  iosPickerContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iosPicker: {
    backgroundColor: Colors.white,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  iosPickerDoneText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  seatsSection: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  seatsNote: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  seatsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  seatOption: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  seatOptionDisabled: {
    backgroundColor: Colors.border,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  seatText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  seatTextActive: {
    color: Colors.white,
  },
  seatTextDisabled: {
    color: Colors.textSecondary,
  },
  dollarSign: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
