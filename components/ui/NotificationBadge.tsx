import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../../constants/Colors';

// Size configurations for different badge sizes
const sizeConfigs = {
  small: {
    height: 18,
    minWidth: 18,
    fontSize: 10,
    borderWidth: 2,
    top: -7,
    right: -7,
  },
  medium: {
    height: 22,
    minWidth: 22,
    fontSize: 12,
    borderWidth: 2.5,
    top: -9,
    right: -9,
  },
  large: {
    height: 26,
    minWidth: 26,
    fontSize: 14,
    borderWidth: 3,
    top: -11,
    right: -11,
  },
};

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  textColor?: string;
  style?: any;
}

export function NotificationBadge({
  count,
  maxCount = 99,
  size = 'medium',
  color = Colors.primary, // App theme blue
  textColor = Colors.white,
  style,
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();
  const sizeConfig = sizeConfigs[size];
  
  // Calculate dynamic dimensions based on content
  const textLength = displayCount.length;
  const isMultiDigit = textLength > 1;
  
  // Dynamic width calculation for better text visibility
  let finalWidth = sizeConfig.height; // Start with circular (width = height)
  
  if (isMultiDigit) {
    // For multi-digit numbers, calculate width based on font size and character count
    const charWidth = sizeConfig.fontSize * 0.65; // Approximate character width
    const padding = 6; // Horizontal padding
    const calculatedWidth = (textLength * charWidth) + padding;
    finalWidth = Math.max(sizeConfig.height, calculatedWidth);
  }
  
  // Ensure minimum width
  finalWidth = Math.max(finalWidth, sizeConfig.minWidth);

  return (
    <View style={[
      styles.badge,
      {
        width: finalWidth,
        height: sizeConfig.height,
        borderRadius: sizeConfig.height / 2, // Always perfectly round
        backgroundColor: color,
        top: sizeConfig.top,
        right: sizeConfig.right,
        borderWidth: sizeConfig.borderWidth,
      },
      style
    ]}>
      <Text style={[
        styles.text,
        {
          color: textColor,
          fontSize: sizeConfig.fontSize,
          lineHeight: sizeConfig.fontSize + 2, // Slight adjustment for better centering
        }
      ]}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: Colors.white,
    // Modern shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    fontWeight: '700', // Bold but not too heavy
    textAlign: 'center',
    letterSpacing: -0.1, // Slight letter spacing for better readability
    includeFontPadding: false, // Android specific - removes extra padding
    textAlignVertical: 'center', // Android specific - centers text vertically
  },
});
