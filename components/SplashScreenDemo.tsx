import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import SplashScreenModern from './SplashScreenModern';

export default function SplashScreenDemo() {
  const [showModernSplash, setShowModernSplash] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#000000' : '#FFFFFF',
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1A1A1A',
      marginBottom: 30,
      textAlign: 'center',
    },
    button: {
      backgroundColor: '#007BFF',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginVertical: 8,
      minWidth: 200,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: '#007BFF',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginVertical: 8,
      minWidth: 200,
      shadowColor: '#007BFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    featureList: {
      marginTop: 30,
      padding: 20,
      backgroundColor: isDark ? '#1A1A1A' : '#F8F9FA',
      borderRadius: 12,
      width: '100%',
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1A1A1A',
      marginBottom: 12,
    },
    feature: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
      marginVertical: 4,
      lineHeight: 20,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#A0A0A0' : '#666666',
      textAlign: 'center',
      marginTop: 20,
      lineHeight: 20,
    },
  });

  if (showModernSplash) {
    return (
      <SplashScreenModern 
        onAnimationComplete={() => setShowModernSplash(false)} 
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Zipply Splash Screen Showcase</Text>
      
      <TouchableOpacity 
        style={[styles.button, styles.primaryButton]}
        onPress={() => setShowModernSplash(true)}
      >
        <Text style={styles.buttonText}>🚀 Premium Zipply Splash</Text>
      </TouchableOpacity>

      <View style={styles.featureList}>
        <Text style={styles.featureTitle}>✨ Premium Features:</Text>
        <Text style={styles.feature}>• 3.5-second precision-timed animation</Text>
        <Text style={styles.feature}>• Diagonal gradient with center glow effect</Text>
        <Text style={styles.feature}>• Flowing motion lines with stroke reveal</Text>
        <Text style={styles.feature}>• Glowing circular nodes with pulse animation</Text>
        <Text style={styles.feature}>• Light sweep text reveal effect</Text>
        <Text style={styles.feature}>• Ambient motion and vignette finale</Text>
        <Text style={styles.feature}>• Modern blue tech aesthetic (#071B34, #1E6BFF, #45C9FF)</Text>
      </View>
    </ScrollView>
  );
}
