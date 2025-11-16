import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableWithoutFeedback, Keyboard, ScrollView, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { LockIcon, EyeIcon, EyeOffIcon, ArrowLeftIcon, CheckCircleIcon } from '../../components/ui/Icons';

export default function ResetPassword() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, resetPassword, forgotPassword } = useAuth();
  
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [loading, setLoading] = useState(false);
  
  // OTP verification state
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Get auth context
  const { session, user } = useAuth();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // OTP handling functions
  const handleDigitChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setCodeError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const getVerificationCode = () => {
    return codeDigits.join('');
  };

  const handleVerifyCode = async () => {
    const verificationCode = getVerificationCode();
    
    if (!email || !verificationCode) {
      setCodeError('Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      setCodeError('Verification code must be 6 digits');
      return;
    }

    setLoading(true);
    setCodeError('');

    const normalizedEmail = String(email).trim().toLowerCase();
    
    console.log('🔐 Verifying password reset code:', verificationCode, 'for email:', normalizedEmail);
    
    const { error, data } = await verifyOtp(normalizedEmail, verificationCode, 'recovery');
    setLoading(false);
    
    if (error) {
      console.error('❌ Password reset verification error:', error);
      
      const errorCode = (error as any)?.code;
      const errorMessage = (error as any)?.message || 'Verification failed';
      
      if (errorCode === 'otp_expired' || errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        Alert.alert(
          'Code Expired',
          'Your verification code has expired or is invalid. Please request a new code.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Get New Code',
              onPress: async () => {
                setLoading(true);
                const { error: resendError } = await forgotPassword(normalizedEmail);
                setLoading(false);
                
                if (resendError) {
                  Alert.alert('Error', 'Failed to send new verification code. Please try again.');
                } else {
                  Alert.alert('New Code Sent', 'A fresh verification code has been sent to your email.');
                  setCodeDigits(['', '', '', '', '', '']);
                }
              },
            },
          ]
        );
        return;
      }
      
      setCodeError('Invalid verification code. Please try again.');
    } else {
      console.log('✅ Password reset code verified successfully!');
      console.log('📊 Session data after OTP verification:', data?.session?.user?.id);
      
      // Check if we have a valid session
      if (data?.session) {
        console.log('✅ Session established, proceeding to password reset');
        setStep('reset');
      } else {
        console.error('❌ No session after OTP verification');
        Alert.alert(
          'Session Error',
          'There was an issue with the verification. Please try the forgot password process again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/auth/forgot-password')
            }
          ]
        );
      }
    }
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[!@#$%^&*])/.test(password)) strength++;
    return strength;
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 2) return 'Weak';
    if (strength < 4) return 'Medium';
    return 'Strong';
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 2) return Colors.error;
    if (strength < 4) return '#f59e0b';
    return '#10b981';
  };

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordStrength = getPasswordStrength(newPassword);

  const handleResetPassword = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setLoading(true);
    setPasswordError('');

    console.log('🔑 Updating password directly...');

    // Call Supabase directly to avoid any AuthContext issues
    import('../../lib/supabase')
      .then(({ supabase }) => {
        return supabase.auth.updateUser({ password: newPassword });
      })
      .then(({ error }) => {
        console.log('📊 Direct Supabase response received');
        setLoading(false);
        
        if (error) {
          console.error('❌ Password update failed:', error);
          Alert.alert('Error', 'Failed to update password. Please try again.');
          return;
        }

        console.log('✅ Password updated successfully, going to homescreen...');
        router.replace('/(tabs)/home');
      })
      .catch((error) => {
        console.error('💥 Direct Supabase error:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to update password. Please try again.');
      });
  };

  const handleResendCode = async () => {
    if (!email) return;
    
    setLoading(true);
    const normalizedEmail = String(email).trim().toLowerCase();
    const { error } = await forgotPassword(normalizedEmail);
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', 'Failed to resend verification code. Please try again.');
    } else {
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setCodeDigits(['', '', '', '', '', '']);
    }
  };

  const handleBack = () => {
    if (step === 'reset') {
      setStep('verify');
    } else {
      router.back();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableWithoutFeedback onPress={handleBack}>
            <View style={styles.backButton}>
              <ArrowLeftIcon size={24} color={Colors.text} />
            </View>
          </TouchableWithoutFeedback>

          {/* Icon */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.iconContainer}>
              {showSuccess ? (
                <CheckCircleIcon size={64} color="#10b981" />
              ) : (
                <LockIcon size={64} color={Colors.primary} />
              )}
            </View>
          </TouchableWithoutFeedback>

          {showSuccess ? (
            // Success Screen
            <>
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.titleSection}>
                  <Text style={styles.title}>Password Updated!</Text>
                  <Text style={styles.subtitle}>
                    Your password has been successfully updated. You can now sign in with your new password.
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actions}>
                  <Button
                    title="Go to Sign In"
                    onPress={() => router.replace('/auth/login')}
                    style={styles.primaryButton}
                  />
                </View>
              </TouchableWithoutFeedback>
            </>
          ) : step === 'verify' ? (
            // OTP Verification Step
            <>
              {/* Title */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.titleSection}>
                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    We've sent a 6-digit code to
                  </Text>
                  <Text style={styles.email}>{email}</Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Code Input - 6 Boxes */}
              <View style={styles.codeSection}>
                <Text style={styles.codeLabel}>Enter the 6-digit code from your email:</Text>
                <Text style={styles.codeSubLabel}>Code is valid for 10 minutes</Text>
                
                <View style={styles.codeInputContainer}>
                  {codeDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { inputRefs.current[index] = ref; }}
                      style={[
                        styles.codeBox,
                        digit ? styles.codeBoxFilled : null,
                        codeError ? styles.codeBoxError : null
                      ]}
                      value={digit}
                      onChangeText={(value) => handleDigitChange(value, index)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                      autoFocus={index === 0}
                    />
                  ))}
                </View>
                
                {codeError ? (
                  <Text style={styles.errorText}>{codeError}</Text>
                ) : null}
              </View>

              {/* Actions */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actions}>
                  <Button
                    title="Verify Code"
                    onPress={handleVerifyCode}
                    loading={loading}
                    disabled={getVerificationCode().length !== 6}
                    style={styles.primaryButton}
                  />
                  
                  <Button
                    title="Resend Code"
                    onPress={handleResendCode}
                    loading={loading}
                    variant="outline"
                    style={styles.secondaryButton}
                  />
                </View>
              </TouchableWithoutFeedback>
            </>
          ) : (
            // Password Reset Step
            <>
              {/* Title */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.titleSection}>
                  <Text style={styles.title}>Create New Password</Text>
                  <Text style={styles.subtitle}>
                    Your identity has been verified. Please create a new secure password for your account.
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Password Inputs */}
              <View style={styles.inputSection}>
                <Input
                  placeholder="New password"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setPasswordError('');
                  }}
                  secureTextEntry={!showPassword}
                  leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
                  rightIcon={
                    <TouchableWithoutFeedback onPress={() => setShowPassword(!showPassword)}>
                      <View>
                        {showPassword ? (
                          <EyeOffIcon size={20} color={Colors.textSecondary} />
                        ) : (
                          <EyeIcon size={20} color={Colors.textSecondary} />
                        )}
                      </View>
                    </TouchableWithoutFeedback>
                  }
                  error={passwordError}
                  containerStyle={styles.passwordInput}
                />

                <Input
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setPasswordError('');
                  }}
                  secureTextEntry={!showConfirmPassword}
                  leftIcon={<LockIcon size={20} color={Colors.textSecondary} />}
                  rightIcon={
                    <TouchableWithoutFeedback onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <View>
                        {showConfirmPassword ? (
                          <EyeOffIcon size={20} color={Colors.textSecondary} />
                        ) : (
                          <EyeIcon size={20} color={Colors.textSecondary} />
                        )}
                      </View>
                    </TouchableWithoutFeedback>
                  }
                  containerStyle={styles.passwordInput}
                />

                {/* Password Strength Indicator */}
                {newPassword ? (
                  <View style={styles.passwordStrengthContainer}>
                    <Text style={styles.strengthLabel}>Password Strength:</Text>
                    <View style={styles.strengthIndicator}>
                      <View style={[styles.strengthBar, { backgroundColor: getPasswordStrengthColor(passwordStrength), width: `${(passwordStrength / 5) * 100}%` }]} />
                    </View>
                    <Text style={[styles.strengthText, { color: getPasswordStrengthColor(passwordStrength) }]}>
                      {getPasswordStrengthText(passwordStrength)}
                    </Text>
                  </View>
                ) : null}

                {/* Password Match Indicator */}
                {confirmPassword ? (
                  <View style={styles.passwordMatchContainer}>
                    <View style={styles.matchIndicator}>
                      {passwordsMatch ? (
                        <CheckCircleIcon size={16} color="#10b981" />
                      ) : (
                        <View style={styles.noMatchIcon} />
                      )}
                      <Text style={[styles.matchText, { color: passwordsMatch ? '#10b981' : Colors.error }]}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Password Requirements */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.requirementsContainer}>
                  <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                  <Text style={styles.requirementText}>• At least 8 characters long</Text>
                  <Text style={styles.requirementText}>• At least one uppercase letter</Text>
                  <Text style={styles.requirementText}>• At least one lowercase letter</Text>
                  <Text style={styles.requirementText}>• At least one number</Text>
                </View>
              </TouchableWithoutFeedback>

              {/* Actions */}
              <TouchableWithoutFeedback onPress={dismissKeyboard}>
                <View style={styles.actions}>
                  <Button
                    title="Reset Password"
                    onPress={handleResetPassword}
                    loading={loading}
                    disabled={!newPassword || !confirmPassword}
                    style={styles.primaryButton}
                  />
                </View>
              </TouchableWithoutFeedback>
            </>
          )}

          {/* Help Text */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <Text style={styles.helpText}>
              {step === 'verify' 
                ? "Didn't receive the code? Check your spam folder or try resending."
                : "Make sure to choose a strong password that you haven't used before."
              }
            </Text>
          </TouchableWithoutFeedback>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl * 2,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  email: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  codeSection: {
    alignSelf: 'stretch',
    marginBottom: Spacing.xl,
  },
  codeLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  codeSubLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    alignSelf: 'center',
    width: '100%',
  },
  codeBox: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginHorizontal: 6,
    shadowColor: Colors.textSecondary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  codeBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
    color: Colors.primary,
  },
  codeBoxError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  inputSection: {
    alignSelf: 'stretch',
    marginBottom: Spacing.xl,
  },
  passwordInput: {
    marginBottom: Spacing.md,
  },
  requirementsContainer: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  requirementsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  requirementText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  primaryButton: {
    borderRadius: BorderRadius.lg,
  },
  secondaryButton: {
    borderRadius: BorderRadius.lg,
  },
  helpText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  passwordStrengthContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  strengthLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  strengthIndicator: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'right',
  },
  passwordMatchContainer: {
    marginTop: Spacing.sm,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noMatchIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    marginRight: Spacing.xs,
  },
  matchText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginLeft: Spacing.xs,
  },
});
