import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/Colors';

interface VerificationCodeInputProps {
  length?: number;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function VerificationCodeInput({
  length = 6,
  value,
  onChangeText,
  error,
  autoFocus = false,
}: VerificationCodeInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const animatedValues = useRef(
    Array.from({ length }, () => new Animated.Value(1))
  ).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Split the value into individual digits
  const digits = value.split('').slice(0, length);
  while (digits.length < length) {
    digits.push('');
  }

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error) {
      // Shake animation for error
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error, shakeAnimation]);

  const handleChangeText = (text: string, index: number) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length <= 1) {
      const newDigits = [...digits];
      newDigits[index] = numericText;
      
      // Update the full value
      const newValue = newDigits.join('');
      onChangeText(newValue);

      // Auto-focus next input
      if (numericText && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    
    // Scale animation on focus
    Animated.spring(animatedValues[index], {
      toValue: 1.1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleBlur = (index: number) => {
    setFocusedIndex(null);
    
    // Scale back to normal on blur
    Animated.spring(animatedValues[index], {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleBoxPress = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.inputContainer,
          { transform: [{ translateX: shakeAnimation }] }
        ]}
      >
        {digits.map((digit, index) => {
          const isFocused = focusedIndex === index;
          const hasValue = digit !== '';
          const hasError = !!error;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() => handleBoxPress(index)}
            >
              <Animated.View
                style={[
                  styles.inputBox,
                  isFocused && styles.inputBoxFocused,
                  hasValue && styles.inputBoxFilled,
                  hasError && styles.inputBoxError,
                  {
                    transform: [{ scale: animatedValues[index] }],
                  },
                ]}
              >
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.input,
                    isFocused && styles.inputFocused,
                    hasValue && styles.inputFilled,
                    hasError && styles.inputError,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleChangeText(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  onFocus={() => handleFocus(index)}
                  onBlur={() => handleBlur(index)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                  textAlign="center"
                  blurOnSubmit={false}
                />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
      
      {error && (
        <Animated.View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBox: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inputBoxFilled: {
    borderColor: Colors.success,
    backgroundColor: Colors.white,
  },
  inputBoxError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '05',
  },
  input: {
    width: '100%',
    height: '100%',
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    padding: 0,
  },
  inputFocused: {
    color: Colors.primary,
  },
  inputFilled: {
    color: Colors.success,
  },
  inputError: {
    color: Colors.error,
  },
  errorContainer: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
  },
});
