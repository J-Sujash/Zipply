import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, View } from 'react-native';
// import { testSystemHealth } from '../lib/systemTest'; // Temporarily disabled
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors';

interface SystemTestButtonProps {
  style?: any;
}

export const SystemTestButton: React.FC<SystemTestButtonProps> = ({ style }) => {
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    
    try {
      console.log('🧪 Running system health test...');
      // const result = await testSystemHealth(); // Temporarily disabled
      
      // Temporary placeholder
      Alert.alert(
        '🚧 System Test',
        'System health test is temporarily disabled'
      );
      
      /*
      if (result.isHealthy) {
        Alert.alert(
          '✅ System Healthy',
          `All ${result.workingFeatures.length} features are working correctly:\n\n${result.workingFeatures.join('\n• ')}`
        );
      } else {
        Alert.alert(
          '⚠️ System Issues Detected',
          `Working features (${result.workingFeatures.length}):\n• ${result.workingFeatures.join('\n• ')}\n\nIssues (${result.issues.length}):\n• ${result.issues.join('\n• ')}`
        );
      }
      */
    } catch (error: any) {
      console.error('❌ Test failed:', error);
      Alert.alert(
        '❌ Test Failed',
        `Unable to run system test: ${error.message}`
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={runTest}
      disabled={testing}
    >
      <View style={styles.buttonContent}>
        <Text style={styles.buttonText}>
          {testing ? '🧪 Testing...' : '🔧 Test System'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
