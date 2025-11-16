import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    runOnJS,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';

interface SplashScreenModernProps {
  onAnimationComplete?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function SplashScreenModern({ onAnimationComplete }: SplashScreenModernProps) {
  // Phase 1: Ultra-subtle radial glow (0-0.2s)
  const centerGlowOpacity = useSharedValue(0);
  const centerGlowScale = useSharedValue(0.8);
  
  // Phase 2: Liquid light lines (0.2-0.7s)
  const line1Progress = useSharedValue(0);
  const line2Progress = useSharedValue(0);
  const line3Progress = useSharedValue(0);
  const linesDrift = useSharedValue(0);
  
  // Phase 3: Micro-nodes (0.7-1.1s)
  const node1Scale = useSharedValue(1);
  const node2Scale = useSharedValue(1);
  const node3Scale = useSharedValue(1);
  const nodesOpacity = useSharedValue(0);
  
  // Phase 4: Text reveal with specular sweep (1.15-1.65s)
  const textOpacity = useSharedValue(0);
  const textGlowOpacity = useSharedValue(0);
  const lightSweepProgress = useSharedValue(0);
  const backgroundCalm = useSharedValue(0);
  
  // Phase 5: Final refined state (1.65-2.0s)
  const vignetteOpacity = useSharedValue(0);
  const finalGlowIntensity = useSharedValue(0);
  
  // Exit animation
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    const startAnimations = () => {
      // Phase 1: Ultra-subtle radial glow (0-0.2s)
      centerGlowOpacity.value = withTiming(0.15, { 
        duration: 200, 
        easing: Easing.out(Easing.cubic) 
      });
      
      centerGlowScale.value = withTiming(1, { 
        duration: 200, 
        easing: Easing.out(Easing.cubic) 
      });

      // Phase 2: Liquid light lines (0.2-0.7s)
      line1Progress.value = withDelay(200, 
        withTiming(1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );
      line2Progress.value = withDelay(250, 
        withTiming(1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );
      line3Progress.value = withDelay(300, 
        withTiming(1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );
      
      // Ultra-subtle drift (0.5% screen width)
      linesDrift.value = withDelay(200, 
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) })
      );

      // Phase 3: Micro-nodes (0.7-1.1s)
      nodesOpacity.value = withDelay(700, 
        withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) })
      );
      
      // Ultra-precise micro-pulses (3-4% scale)
      node1Scale.value = withDelay(700, 
        withSequence(
          withTiming(1.03, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 150, easing: Easing.inOut(Easing.cubic) })
        )
      );
      node2Scale.value = withDelay(800, 
        withSequence(
          withTiming(1.04, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 150, easing: Easing.inOut(Easing.cubic) })
        )
      );
      node3Scale.value = withDelay(900, 
        withSequence(
          withTiming(1.03, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 150, easing: Easing.inOut(Easing.cubic) })
        )
      );

      // Background calm preparation (1.1s)
      backgroundCalm.value = withDelay(1100, 
        withTiming(1, { duration: 50, easing: Easing.out(Easing.cubic) })
      );

      // Phase 4: Specular text reveal (1.15-1.65s)
      lightSweepProgress.value = withDelay(1150, 
        withTiming(1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );
      
      textOpacity.value = withDelay(1150, 
        withTiming(1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })
      );
      
      textGlowOpacity.value = withDelay(1400, 
        withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
      );

      // Phase 5: Final refined state (1.65-2.0s)
      vignetteOpacity.value = withDelay(1650, 
        withTiming(0.2, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
      
      finalGlowIntensity.value = withDelay(1650, 
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      );

      // Exit sequence (2.0s) - smooth transition without blank screen
      setTimeout(() => {
        if (onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      }, 2000);
    };

    startAnimations();
  }, []);

  // Animated styles
  const centerGlowStyle = useAnimatedStyle(() => ({
    opacity: centerGlowOpacity.value,
    transform: [{ scale: centerGlowScale.value }],
  }));

  const lineStyle = (progress: SharedValue<number>) => useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.6], Extrapolate.CLAMP),
    transform: [
      { 
        scaleX: progress.value 
      },
      { 
        translateX: interpolate(
          linesDrift.value,
          [0, 1],
          [0, width * 0.005],
          Extrapolate.CLAMP
        )
      }
    ],
  }));

  const nodeStyle = (scale: SharedValue<number>) => useAnimatedStyle(() => ({
    opacity: nodesOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const textRevealStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const textGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      textGlowOpacity.value,
      [0, 1],
      [0, 0.3],
      Extrapolate.CLAMP
    ),
  }));

  const lightSweepStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(
        lightSweepProgress.value,
        [0, 1],
        [width * 1.2, -width * 0.2],
        Extrapolate.CLAMP
      )
    }],
    opacity: interpolate(
      lightSweepProgress.value,
      [0, 0.1, 0.9, 1],
      [0, 0.8, 0.8, 0],
      Extrapolate.CLAMP
    ),
  }));

  const vignetteStyle = useAnimatedStyle(() => ({
    opacity: vignetteOpacity.value,
  }));

  const finalGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      finalGlowIntensity.value,
      [0, 1],
      [0, 0.1],
      Extrapolate.CLAMP
    ),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors.gray[900],
    },
    centerGlow: {
      position: 'absolute',
      width: width * 0.8,
      height: width * 0.8,
      borderRadius: width * 0.4,
      backgroundColor: `${Colors.primary}15`,
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 80,
      elevation: 10,
    },
    motionLine: {
      position: 'absolute',
      height: 0.5,
      backgroundColor: Colors.primaryLight,
      shadowColor: Colors.primaryLight,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 2,
      elevation: 3,
      transformOrigin: 'left',
    },
    line1: {
      width: width * 0.35,
      top: height * 0.35,
      left: width * 0.15,
      transform: [{ rotate: '12deg' }],
    },
    line2: {
      width: width * 0.3,
      top: height * 0.5,
      left: width * 0.25,
      transform: [{ rotate: '-8deg' }],
    },
    line3: {
      width: width * 0.28,
      top: height * 0.65,
      left: width * 0.2,
      transform: [{ rotate: '6deg' }],
    },
    glowingNode: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.primaryLight,
      shadowColor: Colors.primaryLight,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
      elevation: 8,
    },
    node1: {
      top: height * 0.37,
      left: width * 0.28,
    },
    node2: {
      top: height * 0.48,
      left: width * 0.42,
    },
    node3: {
      top: height * 0.62,
      left: width * 0.35,
    },
    textContainer: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    zipplyText: {
      fontSize: width * 0.13,
      fontWeight: '500',
      color: Colors.white,
      fontFamily: 'System',
      textAlign: 'center',
      letterSpacing: 2,
      textShadowColor: Colors.primaryLight,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    lightSweep: {
      position: 'absolute',
      width: width * 0.25,
      height: '100%',
      backgroundColor: `${Colors.white}66`,
      shadowColor: Colors.white,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 12,
    },
    vignette: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 120,
      elevation: 3,
    },
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Center glow effect */}
      <Animated.View style={[styles.centerGlow, centerGlowStyle]} />
      
      {/* Phase 2: Motion lines */}
      <Animated.View style={[styles.motionLine, styles.line1, lineStyle(line1Progress)]} />
      <Animated.View style={[styles.motionLine, styles.line2, lineStyle(line2Progress)]} />
      <Animated.View style={[styles.motionLine, styles.line3, lineStyle(line3Progress)]} />

      {/* Phase 3: Glowing nodes */}
      <Animated.View style={[styles.glowingNode, styles.node1, nodeStyle(node1Scale)]} />
      <Animated.View style={[styles.glowingNode, styles.node2, nodeStyle(node2Scale)]} />
      <Animated.View style={[styles.glowingNode, styles.node3, nodeStyle(node3Scale)]} />

      {/* Phase 4: Text reveal with light sweep */}
      <View style={styles.textContainer}>
        {/* Light sweep effect */}
        <Animated.View style={[styles.lightSweep, lightSweepStyle]} />
        
        {/* Zipply text with glow */}
        <Animated.Text style={[styles.zipplyText, textGlowStyle, { position: 'absolute' }]}>
          Zipply
        </Animated.Text>
        <Animated.Text style={[styles.zipplyText, textRevealStyle]}>
          Zipply
        </Animated.Text>
      </View>

      {/* Phase 5: Vignette effect */}
      <Animated.View style={[styles.vignette, vignetteStyle]} />
      
      {/* Final glow enhancement */}
      <Animated.View style={[styles.centerGlow, finalGlowStyle]} />
    </Animated.View>
  );
}
