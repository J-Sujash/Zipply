import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { LockIcon, MailIcon, ArrowLeftIcon } from '../../components/ui/Icons';

export default function ForgotPassword() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.endsWith('.edu');
  };

  const handleSendResetCode = async () => {
    if (!email) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid .edu email address');
      return;
    }

    setLoading(true);
    setEmailError('');

    console.log('🔒 Requesting password reset for:', email);

    const { error } = await forgotPassword(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      console.error('❌ Password reset error:', error);
      if (error.message.includes('User not found')) {
        setEmailError('No account found with this email address');
      } else {
        Alert.alert('Error', 'Failed to send reset code. Please try again.');
      }
    } else {
      console.log('✅ Password reset code sent successfully');
      Alert.alert(
        'Reset Code Sent',
        'We\'ve sent a 6-digit verification code to your email. Use it to reset your password.',
        [
          {
            text: 'OK',
            onPress: () => router.push({
              pathname: '/auth/reset-password',
              params: { email: email.trim().toLowerCase() }
            })
          }
        ]
      );
    }
  };

  const handleBackToLogin = () => {
    router.back();
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
          <TouchableWithoutFeedback onPress={handleBackToLogin}>
            <View style={styles.backButton}>
              <ArrowLeftIcon size={24} color={Colors.text} />
            </View>
          </TouchableWithoutFeedback>

          {/* Icon */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.iconContainer}>
              <LockIcon size={64} color={Colors.primary} />
            </View>
          </TouchableWithoutFeedback>

          {/* Title */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                No worries! Enter your email address and we'll send you a verification code to reset your password.
              </Text>
            </View>
          </TouchableWithoutFeedback>

          {/* Email Input */}
          <View style={styles.inputSection}>
            <Input
              placeholder="Enter your .edu email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<MailIcon size={20} color={Colors.textSecondary} />}
              error={emailError}
              containerStyle={styles.emailInput}
            />
          </View>

          {/* Instructions */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>What happens next?</Text>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  We'll send a 6-digit code to your email
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Enter the code to verify your identity
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Create a new secure password
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>

          {/* Actions */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.actions}>
              <Button
                title="Send Reset Code"
                onPress={handleSendResetCode}
                loading={loading}
                disabled={!email}
                style={styles.sendButton}
              />
              
              <Button
                title="Back to Sign In"
                onPress={handleBackToLogin}
                variant="outline"
                style={styles.backToLoginButton}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Help Text */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <Text style={styles.helpText}>
              Remember your password? Go back to sign in and try again.
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
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  inputSection: {
    alignSelf: 'stretch',
    marginBottom: Spacing.xl,
  },
  emailInput: {
    marginBottom: 0,
  },
  instructionsContainer: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  instructionsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stepNumber: {
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sendButton: {
    borderRadius: BorderRadius.lg,
  },
  backToLoginButton: {
    borderRadius: BorderRadius.lg,
  },
  helpText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
