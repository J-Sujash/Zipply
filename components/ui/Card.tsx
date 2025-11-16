import React from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { BorderRadius, Colors, Spacing } from '../../constants/Colors';
import { getShadowStyle } from '../../lib/shadowUtils';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
}) => {
  const cardStyle = [
    styles.base,
    styles[variant],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.95}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  default: {
    backgroundColor: Colors.white,
  },
  elevated: {
    backgroundColor: Colors.white,
    ...getShadowStyle(
      Colors.black,
      { width: 0, height: 2 },
      0.1,
      8,
      4
    ),
  },
  outlined: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
