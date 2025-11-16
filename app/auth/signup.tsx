import DateTimePicker from '@react-native-community/datetimepicker';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { BirthdayIcon, CalendarIcon, CheckIcon, DescriptionIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, PhoneIcon, SchoolIcon, UserIcon } from '../../components/ui/Icons';
import { Input } from '../../components/ui/Input';
import { Picker } from '../../components/ui/Picker';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    school: '',
    gradYear: new Date().getFullYear() + 4,
    degree: 'bachelor' as 'bachelor' | 'masters' | 'phd',
    major: '',
    gender: '' as 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | '',
    description: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().getFullYear() - 20, 0, 1)); // Default to 20 years ago
  
  // Calculate the maximum date (18 years ago from today)
  const getMaximumDate = () => {
    const today = new Date();
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@') || !formData.email.endsWith('.edu')) {
      newErrors.email = 'Please use a valid .edu email address';
    }
    
    if (formData.phoneNumber.trim()) {
      const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);
      if (normalizedPhone.length !== 10) {
        newErrors.phoneNumber = 'Please enter a valid 10-digit US phone number';
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      // Parse the date string as local date to avoid timezone issues
      const [year, month, day] = formData.dateOfBirth.split('-').map(Number);
      const birthDate = new Date(year, month - 1, day); // month is 0-indexed
      const today = new Date();
      
      // Calculate exact age
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      // Adjust age if birthday hasn't occurred this year yet
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        newErrors.dateOfBirth = `You must be at least 18 years old to sign up. You are currently ${age} years old.`;
      } else if (age > 100) {
        newErrors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }
    
    if (!formData.school.trim()) {
      newErrors.school = 'School name is required';
    }
    
    if (formData.gradYear < new Date().getFullYear() || formData.gradYear > new Date().getFullYear() + 10) {
      newErrors.gradYear = 'Please enter a valid graduation year';
    }
    
    // Major is now optional - no validation needed
    
    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the Terms and Conditions to create an account';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const { signUp } = useAuth();

  const handleSignup = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const { error } = await signUp(formData.email, formData.password, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        school: formData.school,
        grad_year: formData.gradYear,
        degree: formData.degree,
        major: formData.major || undefined, // Optional field
        phone_number: formData.phoneNumber ? normalizePhoneNumber(formData.phoneNumber) : undefined, // Optional field
        gender: formData.gender || undefined,
        description: formData.description || undefined,
        school_email: formData.email,
        rating: 0,
        is_verified: false,
        total_rides_as_driver: 0,
        total_rides_as_passenger: 0,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
      } else {
        // Redirect to email verification screen
        router.replace(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const phoneNumber = value.replace(/[^\d]/g, '');
    
    // Limit to 10 digits for US numbers
    const limitedPhoneNumber = phoneNumber.slice(0, 10);
    
    // Return empty string if no digits
    if (limitedPhoneNumber.length === 0) {
      return '';
    }
    
    // Format as (XXX) XXX-XXXX
    if (limitedPhoneNumber.length >= 6) {
      return `(${limitedPhoneNumber.slice(0, 3)}) ${limitedPhoneNumber.slice(3, 6)}-${limitedPhoneNumber.slice(6)}`;
    } else if (limitedPhoneNumber.length >= 3) {
      return `(${limitedPhoneNumber.slice(0, 3)}) ${limitedPhoneNumber.slice(3)}`;
    } else {
      return limitedPhoneNumber;
    }
  };

  const normalizePhoneNumber = (formattedPhone: string) => {
    // Remove all formatting and return just digits
    return formattedPhone.replace(/[^\d]/g, '');
  };

  const handlePhoneNumberChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    updateFormData('phoneNumber', formatted);
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      // Format date as YYYY-MM-DD for database using local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      updateFormData('dateOfBirth', formattedDate);
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  const hideDatePicker = () => {
    setShowDatePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select your date of birth';
    // Parse the date string as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
            <Text style={styles.title}>Join Zipply</Text>
            <Text style={styles.subtitle}>
              Create your account to start carpooling with fellow students
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <Input
                label="First Name"
                placeholder="First name"
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
                leftIcon={<UserIcon size={20} color={Colors.textSecondary} />}
                error={errors.firstName}
                containerStyle={styles.nameInput}
                required
              />
              <Input
                label="Last Name"
                placeholder="Last name"
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
                leftIcon={<UserIcon size={20} color={Colors.textSecondary} />}
                error={errors.lastName}
                containerStyle={styles.nameInput}
                required
              />
            </View>

            <Input
              label="University Email"
              placeholder="Enter your .edu email"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<MailIcon size={20} color={Colors.textSecondary} />}
              error={errors.email}
              required
            />

            <Input
              label="Phone Number (Optional)"
              placeholder="(555) 123-4567"
              value={formData.phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              leftIcon={<PhoneIcon size={20} color={Colors.textSecondary} />}
              error={errors.phoneNumber}
            />

            <Input
              label="Password"
              placeholder="Create a password"
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              secureTextEntry={!showPassword}
              leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
              rightIcon={
                showPassword ? (
                  <EyeOffIcon size={20} color={Colors.textSecondary} />
                ) : (
                  <EyeIcon size={20} color={Colors.textSecondary} />
                )
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={errors.password}
              required
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              secureTextEntry={!showConfirmPassword}
              leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
              rightIcon={
                showConfirmPassword ? (
                  <EyeOffIcon size={20} color={Colors.textSecondary} />
                ) : (
                  <EyeIcon size={20} color={Colors.textSecondary} />
                )
              }
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              error={errors.confirmPassword}
              required
            />

            {/* Date of Birth Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Date of Birth <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.helperText}>
                You must be at least 18 years old to create an account
              </Text>
              <TouchableOpacity
                style={[
                  styles.datePickerButton,
                  errors.dateOfBirth && styles.datePickerError
                ]}
                onPress={showDatePickerModal}
                activeOpacity={0.7}
              >
                <BirthdayIcon size={20} color={Colors.textSecondary} />
                <Text style={[
                  styles.datePickerText,
                  !formData.dateOfBirth && styles.datePickerPlaceholder
                ]}>
                  {formatDisplayDate(formData.dateOfBirth)}
                </Text>
              </TouchableOpacity>
              {errors.dateOfBirth && (
                <Text style={styles.inputError}>{errors.dateOfBirth}</Text>
              )}
            </View>

            {/* Date Picker Modal */}
            {Platform.OS === 'ios' ? (
              <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={hideDatePicker}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={hideDatePicker}>
                        <Text style={styles.modalButton}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>Select Date of Birth</Text>
                      <TouchableOpacity onPress={hideDatePicker}>
                        <Text style={[styles.modalButton, styles.modalDoneButton]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      maximumDate={getMaximumDate()}
                      minimumDate={new Date(1900, 0, 1)}
                      textColor={Colors.text}
                      style={styles.datePickerIOS}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={getMaximumDate()}
                  minimumDate={new Date(1900, 0, 1)}
                />
              )
            )}

            <Input
              label="School/University"
              placeholder="Enter your school name"
              value={formData.school}
              onChangeText={(value) => updateFormData('school', value)}
              leftIcon={<SchoolIcon size={20} color={Colors.textSecondary} />}
              error={errors.school}
              required
            />

            <Input
              label="Graduation Year"
              placeholder="2025"
              value={formData.gradYear.toString()}
              onChangeText={(value) => setFormData(prev => ({ ...prev, gradYear: parseInt(value) || new Date().getFullYear() + 4 }))}
              keyboardType="numeric"
              leftIcon={<CalendarIcon size={20} color={Colors.textSecondary} />}
              error={errors.gradYear}
              required
            />

            <Picker
              label="Degree Level"
              value={formData.degree}
              onValueChange={(value) => updateFormData('degree', value as string)}
              items={[
                { label: 'Bachelor\'s Degree', value: 'bachelor' },
                { label: 'Master\'s Degree', value: 'masters' },
                { label: 'PhD/Doctorate', value: 'phd' },
              ]}
              required
            />

            <Input
              label="Major/Field of Study (Optional)"
              placeholder="Enter your major or field of study"
              value={formData.major}
              onChangeText={(value) => updateFormData('major', value)}
              leftIcon={<SchoolIcon size={20} color={Colors.textSecondary} />}
              error={errors.major}
            />

            <Picker
              label="Gender (Optional)"
              value={formData.gender}
              onValueChange={(value) => updateFormData('gender', value as string)}
              items={[
                { label: 'Select Gender', value: '' },
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Non-binary', value: 'non-binary' },
                { label: 'Prefer not to say', value: 'prefer-not-to-say' },
              ]}
            />

            <Input
              label="About You (Optional)"
              placeholder="Tell us a bit about yourself..."
              value={formData.description}
              onChangeText={(value) => updateFormData('description', value)}
              multiline
              numberOfLines={3}
              leftIcon={<DescriptionIcon size={20} color={Colors.textSecondary} />}
              containerStyle={styles.descriptionInput}
            />

            {/* Terms and Conditions Checkbox */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  agreedToTerms && styles.checkboxChecked
                ]}>
                  {agreedToTerms && (
                    <CheckIcon size={16} color={Colors.white} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text 
                    style={styles.termsLinkText}
                    onPress={() => router.push('/terms-privacy')}
                  >
                    Terms and Conditions
                  </Text>
                  {' '}and{' '}
                  <Text 
                    style={styles.termsLinkText}
                    onPress={() => router.push('/terms-privacy')}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
              {errors.terms && (
                <Text style={styles.termsError}>{errors.terms}</Text>
              )}
            </View>

            <Button
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              style={styles.signupButton}
              disabled={!agreedToTerms}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Link href="/auth/login" style={styles.link}>
                  Sign in
                </Link>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    flex: 1,
    paddingTop: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  signupButton: {
    marginTop: Spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontWeight: '600',
  },
  descriptionInput: {
    marginBottom: Spacing.lg,
  },
  termsContainer: {
    marginBottom: Spacing.lg,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 18,
    flex: 1,
    flexWrap: 'wrap',
  },
  termsLink: {
    // No additional styling needed for TouchableOpacity
  },
  termsLinkText: {
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsError: {
    fontSize: FontSize.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
    marginLeft: 32, // Align with text content
  },
  // Date picker styles
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  helperText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  required: {
    color: Colors.error,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    minHeight: 50,
  },
  datePickerError: {
    borderColor: Colors.error,
  },
  datePickerText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  datePickerPlaceholder: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  inputError: {
    fontSize: FontSize.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  // Modal styles for iOS date picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 400,
    paddingBottom: 34, // Safe area padding for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalButton: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalDoneButton: {
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  datePickerIOS: {
    backgroundColor: Colors.white,
    height: 200,
    width: '100%',
  },
});
