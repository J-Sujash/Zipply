import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface AnimatedTextProps {
  text: string;
  delay?: number;
  style?: any;
  glowStyle?: any;
  showGlow?: boolean;
}

const { width } = Dimensions.get('window');

export default function AnimatedText({ 
  text, 
  delay = 0, 
  style, 
  glowStyle,
  showGlow = false 
}: AnimatedTextProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const letters = text.split('');
  const animationValues = letters.map(() => ({
    opacity: useSharedValue(0),
    translateY: useSharedValue(30),
    scale: useSharedValue(0.5),
    rotation: useSharedValue(-15),
  }));

  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate each letter with staggered timing
    letters.forEach((_, index) => {
      const letterDelay = delay + (index * 80); // 80ms stagger between letters
      
      animationValues[index].opacity.value = withDelay(
        letterDelay,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
      
      animationValues[index].translateY.value = withDelay(
        letterDelay,
        withSpring(0, {
          damping: 12,
          stiffness: 100,
          mass: 0.8,
        })
      );
      
      animationValues[index].scale.value = withDelay(
        letterDelay,
        withSpring(1, {
          damping: 10,
          stiffness: 120,
        })
      );
      
      animationValues[index].rotation.value = withDelay(
        letterDelay,
        withSpring(0, {
          damping: 15,
          stiffness: 100,
        })
      );
    });

    // Glow effect after all letters are animated
    if (showGlow) {
      glowOpacity.value = withDelay(
        delay + (letters.length * 80) + 200,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
      );
    }
  }, [delay, text, showGlow]);

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    letter: {
      fontSize: width * 0.12,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#0A0A0A',
      fontFamily: 'System',
    },
    glowText: {
      position: 'absolute',
      fontSize: width * 0.12,
      fontWeight: '700',
      color: '#007BFF',
      fontFamily: 'System',
      shadowColor: '#007BFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 20,
      elevation: 20,
    },
  });

  return (
    <View style={styles.container}>
      {/* Glow text behind */}
      {showGlow && (
        <Animated.Text style={[styles.glowText, glowStyle, glowAnimatedStyle]}>
          {text}
        </Animated.Text>
      )}
      
      {/* Individual animated letters */}
      {letters.map((letter, index) => {
        const letterStyle = useAnimatedStyle(() => ({
          opacity: animationValues[index].opacity.value,
          transform: [
            { translateY: animationValues[index].translateY.value },
            { scale: animationValues[index].scale.value },
            { rotate: `${animationValues[index].rotation.value}deg` },
          ],
        }));

        return (
          <Animated.Text
            key={index}
            style={[styles.letter, style, letterStyle]}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </Animated.Text>
        );
      })}
    </View>
  );
}
