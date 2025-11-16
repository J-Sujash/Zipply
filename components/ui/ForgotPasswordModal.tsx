import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Alert,
  Keyboard,
  StatusBar,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from './Button';
import { Input } from './Input';
import { VerificationCodeInput } from './VerificationCodeInput';
import { 
  XIcon, 
  MailIcon, 
  LockIcon, 
  ShieldCheckIcon, 
  ArrowLeftIcon,
  CheckCircleIcon 
} from './Icons';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'email' | 'verification' | 'newPassword' | 'success';

const { height: screenHeight } = Dimensions.get('window');

export function ForgotPasswordModal({
  visible,
  onClose,
}: ForgotPasswordModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset state when modal closes
      setCurrentStep('email');
      setEmail('');
      setVerificationCode('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      setLoading(false);
    }
  }, [visible, slideAnim, fadeAnim]);

  useEffect(() => {
    if (!visible) return;

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        // Move modal up by 3/4 of keyboard height with smooth animation
        const keyboardHeight = event.endCoordinates.height;
        const moveUpDistance = -(keyboardHeight * 0.75);
        
        Animated.timing(keyboardAnim, {
          toValue: moveUpDistance,
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        Animated.timing(keyboardAnim, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [visible, keyboardAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const validateEmail = () => {
    const newErrors: Record<string, string> = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@') || !email.endsWith('.edu')) {
      newErrors.email = 'Please use a valid .edu email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateVerificationCode = () => {
    const newErrors: Record<string, string> = {};
    
    if (!verificationCode.trim()) {
      newErrors.verificationCode = 'Verification code is required';
    } else if (verificationCode.length !== 6) {
      newErrors.verificationCode = 'Please enter a 6-digit code';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateNewPassword = () => {
    const newErrors: Record<string, string> = {};
    
    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendResetEmail = async () => {
    if (!validateEmail()) return;
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, you would call your password reset API here
      // const { error } = await resetPassword(email);
      
      setCurrentStep('verification');
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!validateVerificationCode()) return;
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, you would verify the code here
      // const { error } = await verifyResetCode(email, verificationCode);
      
      setCurrentStep('newPassword');
    } catch (error) {
      Alert.alert('Error', 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validateNewPassword()) return;
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, you would update the password here
      // const { error } = await updatePassword(email, verificationCode, newPassword);
      
      setCurrentStep('success');
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackStep = () => {
    if (currentStep === 'verification') {
      setCurrentStep('email');
    } else if (currentStep === 'newPassword') {
      setCurrentStep('verification');
    }
    setErrors({});
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'email':
        return (
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.stepContainer}>
              {/* Hero Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.heroSection}>
                  <View style={styles.heroIcon}>
                    <MailIcon size={32} color={Colors.white} />
                  </View>
                  <Text style={styles.heroTitle}>Reset Your Password</Text>
                  <Text style={styles.heroSubtitle}>
                    Enter your university email and we&apos;ll send you a secure verification code
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Form Section */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>University Email Address</Text>
                  <Input
                    placeholder="your.email@university.edu"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon={<MailIcon size={20} color={Colors.textSecondary} />}
                    error={errors.email}
                    containerStyle={styles.modernInput}
                  />
                </View>
              </View>

              {/* Action Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actionSection}>
                  <Button
                    title="Send Verification Code"
                    onPress={handleSendResetEmail}
                    loading={loading}
                    style={styles.primaryActionButton}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        );

      case 'verification':
        return (
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.stepContainer}>
              {/* Hero Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.heroSection}>
                  <View style={styles.heroIcon}>
                    <ShieldCheckIcon size={32} color={Colors.white} />
                  </View>
                  <Text style={styles.heroTitle}>Check Your Email</Text>
                  <Text style={styles.heroSubtitle}>
                    We&apos;ve sent a 6-digit verification code to
                  </Text>
                  <Text style={styles.emailHighlight}>{email}</Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Form Section */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.codeInputContainer}>
                    <VerificationCodeInput
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      error={errors.verificationCode}
                      autoFocus={true}
                    />
                  </View>
                </View>
                
                <TouchableWithoutFeedback onPress={dismissKeyboard}>
                  <View style={styles.helpSection}>
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerText}>⏱ Expires in 10:00</Text>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>

              {/* Action Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actionSection}>
                  <Button
                    title="Verify & Continue"
                    onPress={handleVerifyCode}
                    loading={loading}
                    style={styles.primaryActionButton}
                  />
                  
                  <TouchableOpacity 
                    style={styles.secondaryAction}
                    onPress={handleSendResetEmail}
                  >
                    <Text style={styles.secondaryActionText}>
                      Didn&apos;t receive the code? <Text style={styles.linkText}>Resend</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        );

      case 'newPassword':
        return (
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.stepContainer}>
              {/* Hero Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.heroSection}>
                  <View style={styles.heroIcon}>
                    <LockIcon size={32} color={Colors.white} />
                  </View>
                  <Text style={styles.heroTitle}>Create New Password</Text>
                  <Text style={styles.heroSubtitle}>
                    Choose a strong password to secure your account
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Form Section */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <Input
                    placeholder="Enter your new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
                    error={errors.newPassword}
                    containerStyle={styles.modernInput}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <Input
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
                    error={errors.confirmPassword}
                    containerStyle={styles.modernInput}
                  />
                </View>

                <TouchableWithoutFeedback onPress={dismissKeyboard}>
                  <View style={styles.requirementsCard}>
                    <Text style={styles.requirementsTitle}>Password Requirements</Text>
                    <View style={styles.requirementsList}>
                      <View style={styles.requirementItem}>
                        <View style={[styles.requirementCheck, newPassword.length >= 6 && styles.requirementMet]}>
                          <Text style={styles.checkMark}>{newPassword.length >= 6 ? '✓' : '○'}</Text>
                        </View>
                        <Text style={[styles.requirementText, newPassword.length >= 6 && styles.requirementTextMet]}>
                          At least 6 characters
                        </Text>
                      </View>
                      <View style={styles.requirementItem}>
                        <View style={[styles.requirementCheck, newPassword === confirmPassword && newPassword.length > 0 && styles.requirementMet]}>
                          <Text style={styles.checkMark}>{newPassword === confirmPassword && newPassword.length > 0 ? '✓' : '○'}</Text>
                        </View>
                        <Text style={[styles.requirementText, newPassword === confirmPassword && newPassword.length > 0 && styles.requirementTextMet]}>
                          Passwords match
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>

              {/* Action Section */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actionSection}>
                  <Button
                    title="Update Password"
                    onPress={handleResetPassword}
                    loading={loading}
                    style={styles.primaryActionButton}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        );

      case 'success':
        return (
          <>
            <View style={styles.stepHeader}>
              <View style={[styles.iconContainer, styles.successIcon]}>
                <CheckCircleIcon size={24} color={Colors.success} />
              </View>
              <Text style={styles.stepTitle}>Password Reset Successful!</Text>
              <Text style={styles.stepSubtitle}>
                Your password has been successfully reset. You can now sign in with your new password.
              </Text>
            </View>

            <View style={styles.stepActions}>
              <Button
                title="Back to Sign In"
                onPress={handleClose}
                style={styles.primaryButton}
              />
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      
      {/* Backdrop */}
      <Animated.View 
        style={[styles.backdrop, { opacity: fadeAnim }]}
      >
        <TouchableOpacity 
          style={styles.backdropTouch} 
          activeOpacity={1} 
          onPress={handleClose}
        />
      </Animated.View>
      
      {/* Modal Container */}
      <Animated.View 
        style={[
          styles.modalContainer,
          {
            transform: [
              { translateY: slideAnim },
              { translateY: keyboardAnim }
            ],
          },
        ]}
      >
        {/* Modern Header */}
        <View style={styles.modernHeader}>
          <View style={styles.headerTop}>
            {currentStep !== 'email' && currentStep !== 'success' && (
              <TouchableOpacity 
                style={styles.modernBackButton} 
                onPress={handleBackStep}
              >
                <ArrowLeftIcon size={24} color={Colors.text} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.modernCloseButton} 
              onPress={handleClose}
            >
              <XIcon size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Progress Indicator */}
          <View style={styles.modernProgressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${((['email', 'verification', 'newPassword', 'success'].indexOf(currentStep) + 1) / 4) * 100}%` 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              Step {['email', 'verification', 'newPassword', 'success'].indexOf(currentStep) + 1} of 4
            </Text>
          </View>
        </View>

        {/* Content Area */}
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <ScrollView 
            style={styles.modernContent}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>
        </TouchableWithoutFeedback>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdropTouch: {
    flex: 1,
  },
  
  // Modal Container
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: screenHeight * 0.75,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  
  // Modern Header
  modernHeader: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modernBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernProgressContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressTrack: {
    width: 120,
    height: 4,
    backgroundColor: Colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  
  // Modern Content
  modernContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successIcon: {
    backgroundColor: Colors.success + '15',
  },
  stepTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  inputSection: {
    gap: Spacing.lg,
  },
  emailSection: {
    gap: Spacing.xl,
  },
  emailInput: {
    width: '100%',
  },
  verificationSection: {
    alignItems: 'center',
    gap: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },
  passwordSection: {
    gap: Spacing.xl,
  },
  labelContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  fieldDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeInputWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  passwordInputs: {
    gap: Spacing.md,
  },
  codeInputSection: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  codeInputLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  stepActions: {
    gap: Spacing.md,
    paddingTop: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  primaryButton: {
    marginBottom: Spacing.sm,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  
  // Modern Styles
  modernStepHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  modernIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modernStepTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  modernStepSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  modernStepContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  modernVerificationSection: {
    alignItems: 'center',
    gap: Spacing.xl,
  },
  codeHeaderSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  codeMainLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  codeSubLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modernCodeInputContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  codeHelpSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  timerContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modernStepActions: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  modernPrimaryButton: {
    borderRadius: BorderRadius.lg,
    minHeight: 56,
  },
  resendSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resendLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modernResendButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  modernResendText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  
  // Modern Password Section Styles
  modernPasswordSection: {
    gap: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  passwordHeaderSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  passwordMainLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  passwordSubLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modernPasswordInputs: {
    gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  modernInputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  modernInputField: {
    marginBottom: 0,
  },
  passwordRequirements: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  requirementsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  requirementsList: {
    gap: Spacing.md,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  requirementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  requirementMet: {
    backgroundColor: Colors.success,
  },
  requirementText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  requirementTextMet: {
    color: Colors.success,
    fontWeight: '500',
  },
  
  // New Modern Step Styles
  stepContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  emailHighlight: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  
  // Form Section
  formSection: {
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modernInput: {
    marginBottom: 0,
  },
  
  // Code Input
  codeInputContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  helpSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  timerBadge: {
    backgroundColor: Colors.gray[50],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  timerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  
  // Requirements Card
  requirementsCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginTop: Spacing.md,
  },
  requirementCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  checkMark: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  
  // Action Section
  actionSection: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  primaryActionButton: {
    borderRadius: BorderRadius.lg,
    minHeight: 56,
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryActionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
