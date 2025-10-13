import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { notifyRideCreated } from '../../lib/notifications';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import {
  LocationIcon,
  TimeIcon,
  CalendarIcon,
  UserIcon,
  CarIcon,
  CheckIcon,
} from '../../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { NotificationIcon } from '../../components/ui/NotificationIcon';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  seats: number;
  is_default: boolean;
}

export default function CreateRideScreen() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    availableSeats: '1',
    price: '',
    description: '',
    vehicleId: '',
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Dynamic seat options based on selected vehicle
  const getAvailableSeatOptions = () => {
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
    if (!selectedVehicle) return ['1', '2', '3', '4']; // Default options
    
    const maxSeats = selectedVehicle.seats - 1; // Reserve one seat for driver
    const options = [];
    for (let i = 1; i <= maxSeats; i++) {
      options.push(i.toString());
    }
    return options;
  };
  
  const seatOptions = getAvailableSeatOptions();

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  const fetchVehicles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setVehicles(data || []);
      
      // Auto-select default vehicle if available
      const defaultVehicle = data?.find(v => v.is_default);
      if (defaultVehicle) {
        setFormData(prev => ({ 
          ...prev, 
          vehicleId: defaultVehicle.id,
          availableSeats: Math.min(parseInt(prev.availableSeats), defaultVehicle.seats - 1).toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.from.trim()) {
      newErrors.from = 'Departure location is required';
    }

    if (!formData.to.trim()) {
      newErrors.to = 'Destination is required';
    }

    // Date and time validation - prevent past rides (using local timezone)
    // Add 10 minute buffer to account for database timezone differences
    const now = new Date();
    const bufferTime = new Date(now.getTime() + (10 * 60 * 1000)); // Add 10 minutes
    
    const selectedDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes()
    );
    
    console.log(`🕐 CREATE VALIDATION:`);
    console.log(`   Selected: ${selectedDateTime.toLocaleString()}`);
    console.log(`   Now:      ${now.toLocaleString()}`);
    console.log(`   Buffer:   ${bufferTime.toLocaleString()}`);
    console.log(`   Diff:     ${(selectedDateTime.getTime() - bufferTime.getTime()) / 1000 / 60} minutes`);
    
    if (selectedDateTime <= bufferTime) {
      newErrors.date = 'Ride time must be at least 10 minutes in the future';
    }

    if (!formData.availableSeats.trim()) {
      newErrors.availableSeats = 'Number of seats is required';
    }

    if (!formData.price.trim()) {
      newErrors.price = 'Price per seat is required';
    }

    if (!formData.vehicleId) {
      newErrors.vehicleId = 'Please select a vehicle';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateRide = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a ride.');
      return;
    }

    setLoading(true);
    try {
      // Format date and time for database (keep as local time but ensure proper format)
      const selectedDateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes()
      );
      
      // Format as local time for database (database constraint likely expects local time)
      const departureDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const departureTime = `${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}:00`;
      
      console.log(`🕐 DATABASE STORAGE:`);
      console.log(`   Local Selected: ${selectedDateTime.toLocaleString()}`);
      console.log(`   Date: ${departureDate}, Time: ${departureTime}`);

      // Get the selected vehicle to determine total seats
      const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
      const vehicleTotalSeats = selectedVehicle?.seats || parseInt(formData.availableSeats) + 1;

      // Create ride in database
      const { data, error } = await supabase
        .from('rides')
        .insert({
          driver_id: user.id,
          title: `${formData.from} to ${formData.to}`,
          departure_location: formData.from.trim(),
          destination_location: formData.to.trim(),
          departure_date: departureDate,
          departure_time: departureTime,
          total_seats: vehicleTotalSeats, // Store actual vehicle capacity
          available_seats: parseInt(formData.availableSeats), // Store passenger seats available
          price_per_seat: parseFloat(formData.price),
          description: formData.description.trim() || null,
          status: 'active',
          vehicle_id: formData.vehicleId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to the driver about successful ride creation
      await notifyRideCreated(
        user.id,
        `${formData.from} to ${formData.to}`,
        departureDate,
        departureTime,
        data.id
      );

      Alert.alert(
        'Success! 🎉',
        'Your ride has been created successfully! Other students can now find and join your ride.',
        [
          { 
            text: 'View Ride', 
            onPress: () => {
              resetForm();
              router.push({ pathname: '/ride/[rideId]', params: { rideId: data.id } });
            }
          },
          { 
            text: 'Create Another', 
            onPress: () => resetForm(),
            style: 'cancel'
          }
        ]
      );
    } catch (error: any) {
      console.error('Error creating ride:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to create ride. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      from: '',
      to: '',
      availableSeats: '1',
      price: '',
      description: '',
      vehicleId: '',
    });
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setErrors({});
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date && event.type !== 'dismissed') {
      setSelectedDate(date);
      // Clear any existing date error
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
      // Clear any existing time error
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.title}>Create a Ride</Text>
                <Text style={styles.subtitle}>
                  Share your journey with fellow students
                </Text>
              </View>
              <NotificationIcon size={24} color={Colors.text} />
            </View>
          </View>

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

          {/* Vehicle Selection */}
          <Card variant="elevated" style={styles.formCard}>
            <Text style={styles.sectionTitle}>Vehicle Selection</Text>
            
            {vehiclesLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading vehicles...</Text>
              </View>
            ) : vehicles.length === 0 ? (
              <View style={styles.noVehiclesContainer}>
                <CarIcon size={32} color={Colors.textSecondary} />
                <Text style={styles.noVehiclesText}>No vehicles added</Text>
                <Text style={styles.noVehiclesSubtext}>
                  Add a vehicle in your profile to create rides
                </Text>
                <TouchableOpacity
                  style={styles.addVehicleButton}
                  onPress={() => router.push('/vehicles')}
                >
                  <Text style={styles.addVehicleButtonText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {vehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleOption,
                      formData.vehicleId === vehicle.id && styles.vehicleOptionSelected
                    ]}
                    onPress={() => {
                      updateFormData('vehicleId', vehicle.id);
                      // Update available seats based on vehicle capacity
                      const maxSeats = vehicle.seats - 1; // Reserve one seat for driver
                      const currentSeats = parseInt(formData.availableSeats);
                      
                      // If current selection exceeds vehicle capacity, reset to max available
                      if (currentSeats > maxSeats) {
                        updateFormData('availableSeats', maxSeats.toString());
                      }
                      // If no seats selected or current is 0, set to 1
                      else if (currentSeats === 0 || !formData.availableSeats) {
                        updateFormData('availableSeats', '1');
                      }
                    }}
                  >
                    <View style={styles.vehicleInfo}>
                      <CarIcon size={20} color={Colors.primary} />
                      <View style={styles.vehicleDetails}>
                        <Text style={styles.vehicleName}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </Text>
                        <Text style={styles.vehicleSubtitle}>
                          {vehicle.color} • {vehicle.seats} seats • {vehicle.license_plate}
                        </Text>
                      </View>
                    </View>
                    {vehicle.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                    {formData.vehicleId === vehicle.id && (
                      <View style={styles.selectedIndicator}>
                        <CheckIcon size={16} color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {errors.vehicleId && (
                  <Text style={styles.errorText}>{errors.vehicleId}</Text>
                )}
              </View>
            )}
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
                Available Seats <Text style={styles.required}>*</Text>
              </Text>
              {formData.vehicleId ? (
                <View>
                  <View style={styles.vehicleCapacityInfo}>
                    <Text style={styles.capacityText}>
                      🚗 Vehicle capacity: {vehicles.find(v => v.id === formData.vehicleId)?.seats || 0} seats (1 reserved for driver)
                    </Text>
                  </View>
                  <View style={styles.seatsContainer}>
                    {seatOptions.map((seat) => (
                      <TouchableOpacity
                        key={seat}
                        style={[
                          styles.seatOption,
                          formData.availableSeats === seat && styles.seatOptionActive,
                        ]}
                        onPress={() => updateFormData('availableSeats', seat)}
                      >
                        <Text
                          style={[
                            styles.seatText,
                            formData.availableSeats === seat && styles.seatTextActive,
                          ]}
                        >
                          {seat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.noVehicleSelected}>
                  <Text style={styles.noVehicleText}>Please select a vehicle first to see available seat options</Text>
                </View>
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

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Ride Preview</Text>
            <View style={styles.previewContent}>
              <View style={styles.previewRow}>
                <LocationIcon size={16} color={Colors.primary} />
                <Text style={styles.previewText}>
                  {formData.from || 'Departure location'}
                </Text>
              </View>
              <View style={styles.previewArrow}>
                <Text style={styles.arrowText}>↓</Text>
              </View>
              <View style={styles.previewRow}>
                <LocationIcon size={16} color={Colors.accent} />
                <Text style={styles.previewText}>
                  {formData.to || 'Destination'}
                </Text>
              </View>
              <View style={styles.previewDetails}>
                <Text style={styles.previewDetailText}>
                  📅 {formatDate(selectedDate)} • 🕐 {formatTime(selectedTime)}
                </Text>
                <Text style={styles.previewDetailText}>
                  👥 {formData.availableSeats} seats • 💰 ${formData.price || '0'} per seat
                </Text>
              </View>
            </View>
          </View>

          <Button
            title="Create Ride"
            onPress={handleCreateRide}
            loading={loading}
            style={styles.createButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 120, // Add space for floating navbar
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
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
  seatsSection: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  seatsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  seatText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  seatTextActive: {
    color: Colors.white,
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
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  previewContent: {
    gap: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  previewArrow: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  arrowText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  previewDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  previewDetailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  createButton: {
    marginTop: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
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
  // Vehicle selection styles
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  noVehiclesContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noVehiclesText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  noVehiclesSubtext: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  addVehicleButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addVehicleButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  vehicleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '10',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  vehicleName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  vehicleSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  defaultText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Vehicle capacity info styles
  vehicleCapacityInfo: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  capacityText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  noVehicleSelected: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  noVehicleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
