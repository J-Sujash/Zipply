import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Button } from '../../../components/ui/Button';
import {
    CalendarIcon,
    DollarIcon,
    LocationIcon,
    TimeIcon,
    UserIcon,
    XIcon,
} from '../../../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../../../constants/Colors';
import { useAuth } from '../../../contexts/AuthContext';

interface RideData {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_date: string;
  departure_time: string;
  price_per_seat: number;
  total_seats: number;
  available_seats: number;
  description?: string;
}

export default function EditRideScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { user, session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rideData, setRideData] = useState<RideData | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date());
  const [departureTime, setDepartureTime] = useState(new Date());
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [description, setDescription] = useState('');
  
  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rideId) {
      fetchRideData();
    }
    
    // Slide up animation
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [rideId]);

  const fetchRideData = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching ride data for editing:', rideId);
      
      const response = await fetch(`https://zipply-server.onrender.com/api/rides/${rideId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const ride = await response.json();
        setRideData(ride);
        
        // Populate form fields
        setTitle(ride.title);
        setDepartureLocation(ride.departure_location);
        setDestinationLocation(ride.destination_location);
        setDepartureDate(new Date(ride.departure_date));
        
        // Parse time
        const [hours, minutes] = ride.departure_time.split(':');
        const timeDate = new Date();
        timeDate.setHours(parseInt(hours), parseInt(minutes));
        setDepartureTime(timeDate);
        
        setPricePerSeat(ride.price_per_seat.toString());
        setTotalSeats(ride.total_seats.toString());
        setDescription(ride.description || '');
        
        console.log('✅ Ride data loaded successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to load ride data');
        router.back();
      }
    } catch (error: any) {
      console.error('❌ Error fetching ride data:', error);
      Alert.alert('Error', 'Failed to load ride data. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a ride title');
      return;
    }
    if (!departureLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter departure location');
      return;
    }
    if (!destinationLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter destination location');
      return;
    }
    if (!pricePerSeat || parseFloat(pricePerSeat) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price per seat');
      return;
    }
    if (!totalSeats || parseInt(totalSeats) <= 0 || parseInt(totalSeats) > 8) {
      Alert.alert('Validation Error', 'Please enter valid total seats (1-8)');
      return;
    }

    try {
      setSaving(true);
      console.log('💾 Saving ride changes...');

      const updateData = {
        title: title.trim(),
        departure_location: departureLocation.trim(),
        destination_location: destinationLocation.trim(),
        departure_date: departureDate.toISOString().split('T')[0],
        // Convert time to UTC for Render server
        departure_time: new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate(), 
                                  departureTime.getHours(), departureTime.getMinutes(), 0)
                         .toISOString().split('T')[1].substring(0, 8), // HH:MM:SS in UTC
        price_per_seat: parseFloat(pricePerSeat),
        total_seats: parseInt(totalSeats),
        description: description.trim(),
      };

      const response = await fetch(`https://zipply-server.onrender.com/api/rides/${rideId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Success!', 
          'Your ride has been updated successfully. All passengers have been notified of the changes.',
          [{ 
            text: 'OK',
            onPress: () => router.back()
          }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Update Failed', error.detail || 'Failed to update ride. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error updating ride:', error);
      Alert.alert('Error', 'Failed to update ride. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                })
              }]
            }
          ]}
        >
          <StatusBar style="light" />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Ride</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <XIcon size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardContainer}
          >
            <ScrollView 
              style={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formContainer}>
                
                {/* Title */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Ride Title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter ride title"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>

                {/* Locations */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>From</Text>
                  <View style={styles.inputWithIcon}>
                    <LocationIcon size={20} color={Colors.success} />
                    <TextInput
                      style={styles.inputWithIconText}
                      value={departureLocation}
                      onChangeText={setDepartureLocation}
                      placeholder="Departure location"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>To</Text>
                  <View style={styles.inputWithIcon}>
                    <LocationIcon size={20} color={Colors.error} />
                    <TextInput
                      style={styles.inputWithIconText}
                      value={destinationLocation}
                      onChangeText={setDestinationLocation}
                      placeholder="Destination location"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                </View>

                {/* Date and Time */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity 
                      style={styles.dateTimeButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <CalendarIcon size={20} color={Colors.primary} />
                      <Text style={styles.dateTimeText}>{formatDate(departureDate)}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Time</Text>
                    <TouchableOpacity 
                      style={styles.dateTimeButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <TimeIcon size={20} color={Colors.primary} />
                      <Text style={styles.dateTimeText}>{formatTime(departureTime)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Price and Seats */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Price per Seat</Text>
                    <View style={styles.inputWithIcon}>
                      <DollarIcon size={20} color={Colors.primary} />
                      <TextInput
                        style={styles.inputWithIconText}
                        value={pricePerSeat}
                        onChangeText={setPricePerSeat}
                        placeholder="0.00"
                        keyboardType="numeric"
                        placeholderTextColor={Colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Total Seats</Text>
                    <View style={styles.inputWithIcon}>
                      <UserIcon size={20} color={Colors.primary} />
                      <TextInput
                        style={styles.inputWithIconText}
                        value={totalSeats}
                        onChangeText={setTotalSeats}
                        placeholder="1-8"
                        keyboardType="numeric"
                        placeholderTextColor={Colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add any additional details about your ride..."
                    placeholderTextColor={Colors.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <Button
                title="Cancel"
                onPress={handleClose}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title={saving ? "Saving..." : "Save Changes"}
                onPress={handleSave}
                style={styles.saveButton}
                disabled={saving}
                icon={saving ? <ActivityIndicator size="small" color={Colors.white} /> : undefined}
              />
            </View>
          </KeyboardAvoidingView>

          {/* Date/Time Pickers */}
          {showDatePicker && (
            <DateTimePicker
              value={departureDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDepartureDate(selectedDate);
                }
              }}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={departureTime}
              mode="time"
              display="default"
              onChange={(event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) {
                  setDepartureTime(selectedTime);
                }
              }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    elevation: 10,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  formContainer: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  inputWithIconText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  dateTimeText: {
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  saveButton: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
});
