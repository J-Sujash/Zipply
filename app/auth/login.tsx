import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Dimensions,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../../components/ui/Icons';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Spacing } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [keyboardOffset] = useState(new Animated.Value(0));

  React.useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        Animated.timing(keyboardOffset, {
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          toValue: -event.endCoordinates.height * 0.3,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        Animated.timing(keyboardOffset, {
          duration: Platform.OS === 'ios' ? event.duration || 250 : 250,
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [keyboardOffset]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@') || !email.endsWith('.edu')) {
      newErrors.email = 'Please use a valid .edu email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to sign in. Please try again.');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View style={[styles.content, { transform: [{ translateY: keyboardOffset }] }]}>
          <View style={styles.imageContainer}>
            <Image
              source={require('../../assets/images/Sign_in_image.png')}
              style={styles.signInImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to your Zipply account to find and share rides
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="University Email"
              placeholder="Enter your .edu email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<MailIcon size={20} color={Colors.textSecondary} />}
              error={errors.email}
              required
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
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

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Link href="/auth/signup" style={styles.link}>
                  Sign up
                </Link>
              </Text>
            </View>
          </View>
        </Animated.View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  imageContainer: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  signInImage: {
    width: Dimensions.get('window').width * 0.9,
    height: Dimensions.get('window').width * 0.65,
    maxWidth: 340,
    maxHeight: 260,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
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
  loginButton: {
    marginTop: Spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  footerText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
