/**
 * Shadow utilities for web compatibility
 * Converts React Native shadow properties to CSS box-shadow strings
 */

import { Platform } from 'react-native';

// Common shadow presets
export const Shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};

/**
 * Convert React Native shadow properties to CSS box-shadow
 */
export const shadowToBoxShadow = (
  shadowColor?: string,
  shadowOffset?: { width: number; height: number },
  shadowOpacity?: number,
  shadowRadius?: number
): string => {
  if (Platform.OS !== 'web') {
    return '';
  }

  // Default values
  const color = shadowColor || '#000000';
  const offsetX = shadowOffset?.width || 0;
  const offsetY = shadowOffset?.height || 0;
  const opacity = shadowOpacity || 0;
  const blur = shadowRadius || 0;

  // Convert hex color to rgba with opacity
  let rgbaColor = color;
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  return `${offsetX}px ${offsetY}px ${blur}px ${rgbaColor}`;
};

/**
 * Get platform-appropriate shadow style
 */
export const getShadowStyle = (
  shadowColor?: string,
  shadowOffset?: { width: number; height: number },
  shadowOpacity?: number,
  shadowRadius?: number,
  elevation?: number
) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: shadowToBoxShadow(shadowColor, shadowOffset, shadowOpacity, shadowRadius),
    };
  }

  return {
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,
  };
};
