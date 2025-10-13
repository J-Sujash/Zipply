import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  ArrowLeftIcon,
  CarIcon,
  CheckIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '../components/ui/Icons';
import { Input } from '../components/ui/Input';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';

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

export default function VehiclesScreen() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    license_plate: '',
    seats: '4',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.make.trim()) errors.make = 'Make is required';
    if (!formData.model.trim()) errors.model = 'Model is required';
    if (!formData.year.trim()) {
      errors.year = 'Year is required';
    } else {
      const year = parseInt(formData.year);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear + 2) {
        errors.year = `Year must be between 1900 and ${currentYear + 2}`;
      }
    }
    if (!formData.color.trim()) errors.color = 'Color is required';
    if (!formData.license_plate.trim()) errors.license_plate = 'License plate is required';
    if (!formData.seats.trim()) {
      errors.seats = 'Number of seats is required';
    } else {
      const seats = parseInt(formData.seats);
      if (seats < 1 || seats > 15) {
        errors.seats = 'Seats must be between 1 and 15';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddVehicle = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingVehicle) {
        // Update existing vehicle
        const { data, error } = await supabase
          .from('vehicles')
          .update({
            make: formData.make.trim(),
            model: formData.model.trim(),
            year: parseInt(formData.year),
            color: formData.color.trim(),
            license_plate: formData.license_plate.trim().toUpperCase(),
            seats: parseInt(formData.seats),
          })
          .eq('id', editingVehicle.id)
          .select()
          .single();

        if (error) throw error;

        setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? data : v));
      } else {
        // Add new vehicle
        const { data, error } = await supabase
          .from('vehicles')
          .insert({
            user_id: user?.id,
            make: formData.make.trim(),
            model: formData.model.trim(),
            year: parseInt(formData.year),
            color: formData.color.trim(),
            license_plate: formData.license_plate.trim().toUpperCase(),
            seats: parseInt(formData.seats),
            is_default: vehicles.length === 0, // First vehicle is default
          })
          .select()
          .single();

        if (error) throw error;

        setVehicles(prev => [data, ...prev]);
      }

      setShowAddForm(false);
      setEditingVehicle(null);
      resetForm();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Error', editingVehicle ? 'Failed to update vehicle' : 'Failed to add vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year.toString(),
      color: vehicle.color,
      license_plate: vehicle.license_plate,
      seats: vehicle.seats.toString(),
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      make: '',
      model: '',
      year: '',
      color: '',
      license_plate: '',
      seats: '4',
    });
    setFormErrors({});
  };

  const handleSetDefault = async (vehicleId: string) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ is_default: true })
        .eq('id', vehicleId);

      if (error) throw error;

      setVehicles(prev =>
        prev.map(vehicle => ({
          ...vehicle,
          is_default: vehicle.id === vehicleId,
        }))
      );
    } catch (error) {
      console.error('Error setting default vehicle:', error);
      Alert.alert('Error', 'Failed to set default vehicle');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', vehicleId);

              if (error) throw error;

              setVehicles(prev => prev.filter(v => v.id !== vehicleId));
            } catch (error) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const renderVehicleCard = (vehicle: Vehicle) => (
    <Card key={vehicle.id} variant="elevated" style={styles.vehicleCard}>
      {/* Header with default badge and actions */}
      <View style={styles.cardHeader}>
        {vehicle.is_default && (
          <View style={styles.defaultBadge}>
            <CheckIcon size={12} color={Colors.white} />
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditVehicle(vehicle)}
          >
            <EditIcon size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteActionButton]}
            onPress={() => handleDeleteVehicle(vehicle.id)}
          >
            <TrashIcon size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Main vehicle info */}
      <View style={styles.vehicleMainInfo}>
        <View style={styles.vehicleIconContainer}>
          <CarIcon size={32} color={Colors.primary} />
        </View>
        <View style={styles.vehicleDetails}>
          <Text style={styles.vehicleName}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text style={styles.vehicleSubtitle}>
            {vehicle.color} • {vehicle.seats} seats • {vehicle.license_plate}
          </Text>
        </View>
      </View>
      
      {/* Bottom action */}
      {!vehicle.is_default && (
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={styles.setDefaultButton}
            onPress={() => handleSetDefault(vehicle.id)}
          >
            <CheckIcon size={16} color={Colors.primary} />
            <Text style={styles.setDefaultButtonText}>Set as Default Vehicle</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
        >
          <PlusIcon size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {vehicles.length === 0 ? (
          <Card variant="elevated" style={styles.emptyCard}>
            <View style={styles.emptyState}>
              <CarIcon size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No vehicles added</Text>
              <Text style={styles.emptySubtitle}>
                Add your first vehicle to start offering rides
              </Text>
              <Button
                title="Add Vehicle"
                onPress={() => setShowAddForm(true)}
                style={styles.emptyButton}
              />
            </View>
          </Card>
        ) : (
          vehicles.map(renderVehicleCard)
        )}

        {showAddForm && (
          <View style={styles.modernFormContainer}>
            {/* Modern Header */}
            <View style={styles.modernHeader}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconWrapper}>
                  <CarIcon size={20} color={Colors.white} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modernTitle}>
                    {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                  </Text>
                  <Text style={styles.modernSubtitle}>
                    {editingVehicle ? 'Update vehicle details' : 'Enter your vehicle information'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modernCloseButton}
                onPress={() => {
                  setShowAddForm(false);
                  setEditingVehicle(null);
                  resetForm();
                }}
              >
                <XIcon size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Modern Form Content */}
            <View style={styles.modernFormContent}>
              {/* Vehicle Details Card */}
              <View style={styles.modernCard}>
                <Text style={styles.modernCardTitle}>🚗 Vehicle Details</Text>
                
                <View style={styles.modernInputGroup}>
                  <View style={styles.modernRow}>
                    <View style={styles.modernInputWrapper}>
                      <Text style={styles.modernLabel}>Make *</Text>
                      <Input
                        placeholder="Toyota, Honda, Ford"
                        value={formData.make}
                        onChangeText={(value) => setFormData(prev => ({ ...prev, make: value }))}
                        error={formErrors.make}
                        style={styles.modernInput}
                      />
                    </View>
                    <View style={styles.modernInputWrapper}>
                      <Text style={styles.modernLabel}>Model *</Text>
                      <Input
                        placeholder="Camry, Civic, F-150"
                        value={formData.model}
                        onChangeText={(value) => setFormData(prev => ({ ...prev, model: value }))}
                        error={formErrors.model}
                        style={styles.modernInput}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.modernRow}>
                    <View style={styles.modernInputWrapper}>
                      <Text style={styles.modernLabel}>Year *</Text>
                      <Input
                        placeholder="2024"
                        value={formData.year}
                        onChangeText={(value) => setFormData(prev => ({ ...prev, year: value }))}
                        error={formErrors.year}
                        keyboardType="numeric"
                        style={styles.modernInput}
                      />
                    </View>
                    <View style={styles.modernInputWrapper}>
                      <Text style={styles.modernLabel}>Seats *</Text>
                      <Input
                        placeholder="4"
                        value={formData.seats}
                        onChangeText={(value) => setFormData(prev => ({ ...prev, seats: value }))}
                        error={formErrors.seats}
                        keyboardType="numeric"
                        style={styles.modernInput}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.modernInputWrapper}>
                    <Text style={styles.modernLabel}>Color *</Text>
                    <Input
                      placeholder="Silver, Black, White, Blue..."
                      value={formData.color}
                      onChangeText={(value) => setFormData(prev => ({ ...prev, color: value }))}
                      error={formErrors.color}
                      style={styles.modernInput}
                    />
                  </View>
                </View>
              </View>

              {/* Registration Card */}
              <View style={styles.modernCard}>
                <Text style={styles.modernCardTitle}>📋 Registration</Text>
                
                <View style={styles.modernInputGroup}>
                  <View style={styles.modernInputWrapper}>
                    <Text style={styles.modernLabel}>License Plate *</Text>
                    <Input
                      placeholder="ABC-1234"
                      value={formData.license_plate}
                      onChangeText={(value) => setFormData(prev => ({ ...prev, license_plate: value }))}
                      error={formErrors.license_plate}
                      autoCapitalize="characters"
                      style={styles.modernInput}
                    />
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modernActions}>
                <TouchableOpacity
                  style={styles.modernCancelButton}
                  onPress={() => {
                    setShowAddForm(false);
                    setEditingVehicle(null);
                    resetForm();
                  }}
                >
                  <Text style={styles.modernCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modernSubmitButton}
                  onPress={handleAddVehicle}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.modernSubmitText}>
                      {editingVehicle ? '✓ Update Vehicle' : '+ Add Vehicle'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  vehicleCard: {
    marginBottom: Spacing.lg,
    padding: 0,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  defaultText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteActionButton: {
    backgroundColor: Colors.error + '10',
    borderColor: Colors.error + '20',
  },
  vehicleMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  vehicleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    lineHeight: FontSize.xl * 1.2,
  },
  vehicleSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
    lineHeight: FontSize.md * 1.3,
  },
  bottomAction: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  setDefaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    gap: Spacing.sm,
  },
  setDefaultButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyCard: {
    marginTop: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: Spacing.xl,
  },
  // MODERN FORM DESIGN
  modernFormContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.xs,
  },
  modernHeader: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  modernTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  modernSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.white + 'CC',
    fontWeight: '500',
  },
  modernCloseButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernFormContent: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  modernCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  modernCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  modernInputGroup: {
    gap: Spacing.md,
    width: '100%',
  },
  modernRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modernInputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  modernLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernInput: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    width: '100%',
  },
  modernActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    width: '100%',
  },
  modernCancelButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  modernCancelText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modernSubmitButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 44,
  },
  modernSubmitText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  // Legacy styles (keeping for compatibility)
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  widerInput: {
    flex: 1.2,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
});
