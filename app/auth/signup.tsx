import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Picker } from '../../components/ui/Picker';
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, UserIcon, CalendarIcon, SchoolIcon, BirthdayIcon, GenderIcon, DescriptionIcon } from '../../components/ui/Icons';
import { Colors, Spacing, FontSize } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    school: '',
    gradYear: new Date().getFullYear() + 4,
    degree: 'bachelor' as 'bachelor' | 'masters' | 'phd',
    gender: '' as 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | '',
    description: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 16 || age > 100) {
        newErrors.dateOfBirth = 'Please enter a valid age (16-100)';
      }
    }
    
    if (!formData.school.trim()) {
      newErrors.school = 'School name is required';
    }
    
    if (formData.gradYear < new Date().getFullYear() || formData.gradYear > new Date().getFullYear() + 10) {
      newErrors.gradYear = 'Please enter a valid graduation year';
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
        gender: formData.gender || undefined,
        description: formData.description || undefined,
        school_email: formData.email,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
      } else {
        Alert.alert(
          'Success',
          'Account created successfully! Please check your email to verify your account.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
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

            <Input
              label="Date of Birth"
              placeholder="YYYY-MM-DD"
              value={formData.dateOfBirth}
              onChangeText={(value) => updateFormData('dateOfBirth', value)}
              leftIcon={<BirthdayIcon size={20} color={Colors.textSecondary} />}
              error={errors.dateOfBirth}
              required
            />

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

            <Button
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              style={styles.signupButton}
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
});
