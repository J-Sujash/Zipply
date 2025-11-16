import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableWithoutFeedback, Keyboard, ScrollView, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { MailIcon, CheckCircleIcon } from '../../components/ui/Icons';

export default function VerifyEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendConfirmation, verifyOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleDigitChange = (value: string, index: number) => {
    // Only allow single digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setCodeError('');

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const getVerificationCode = () => {
    return codeDigits.join('');
  };

  const handleResendEmail = async () => {
    if (!email) return;
    
    setLoading(true);
    const normalizedEmail = String(email).trim().toLowerCase();
    const { error } = await resendConfirmation(normalizedEmail);
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } else {
      Alert.alert('Success', 'New verification code sent! Please check your inbox.');
      setCodeDigits(['', '', '', '', '', '']); // Clear any existing code
    }
  };

  const handleBackToSignIn = () => {
    router.replace('/auth/login');
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

    // Normalize email (trim + lowercase) before sending to Supabase
    const normalizedEmail = String(email).trim().toLowerCase();
    
    console.log('🔐 Attempting to verify code:', verificationCode, 'for email:', normalizedEmail);
    
    const { error } = await verifyOtp(normalizedEmail, verificationCode);
    setLoading(false);
    
    if (error) {
      console.error('❌ Frontend verification error:', error);
      
      // Handle specific Supabase error codes
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
                const { error: resendError } = await resendConfirmation(normalizedEmail);
                setLoading(false);
                
                if (resendError) {
                  Alert.alert('Error', 'Failed to send new verification code. Please try again.');
                } else {
                  Alert.alert('New Code Sent', 'A fresh verification code has been sent to your email.');
                  setCodeDigits(['', '', '', '', '', '']); // Clear the old code
                }
              },
            },
          ]
        );
        return;
      }
      
      // Generic error for other cases
      setCodeError('Invalid verification code. Please try again.');
    } else {
      console.log('✅ Frontend verification successful!');
      Alert.alert('Success', 'Email verified successfully!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
      ]);
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
          {/* Icon */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.iconContainer}>
              <MailIcon size={64} color={Colors.primary} />
            </View>
          </TouchableWithoutFeedback>

          {/* Title */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Check Your Email</Text>
              
              {/* Subtitle */}
              <Text style={styles.subtitle}>
                We've sent a verification code to
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

          {/* Instructions */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.instructionsContainer}>
              <View style={styles.instructionItem}>
                <CheckCircleIcon size={20} color={Colors.success} />
                <Text style={styles.instructionText}>
                  Check your email for a 6-digit verification code
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <CheckCircleIcon size={20} color={Colors.success} />
                <Text style={styles.instructionText}>
                  Enter the code above to verify your account
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <CheckCircleIcon size={20} color={Colors.success} />
                <Text style={styles.instructionText}>
                  Code expires in 10 minutes for security
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>

          {/* Actions */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.actions}>
              <Button
                title="Verify Code"
                onPress={handleVerifyCode}
                loading={loading}
                disabled={getVerificationCode().length !== 6}
                style={styles.verifyButton}
              />
              
              <Button
                title="Resend Email"
                onPress={handleResendEmail}
                loading={loading}
                variant="outline"
                style={styles.resendButton}
              />
              
              <Button
                title="Back to Sign In"
                onPress={handleBackToSignIn}
                style={styles.backButton}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Help Text */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <Text style={styles.helpText}>
              Didn't receive the email? Check your spam folder or try resending.
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl * 2,
    alignItems: 'center',
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
    marginBottom: Spacing.lg,
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
  codeInput: {
    marginBottom: 0,
  },
  instructionsContainer: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  instructionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginLeft: Spacing.md,
    flex: 1,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  verifyButton: {
    borderRadius: BorderRadius.lg,
  },
  resendButton: {
    borderRadius: BorderRadius.lg,
  },
  backButton: {
    borderRadius: BorderRadius.lg,
  },
  helpText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
});
