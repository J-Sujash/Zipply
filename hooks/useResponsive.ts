import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

interface ScreenDimensions {
  width: number;
  height: number;
}

interface ResponsiveBreakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
}

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

export const useResponsive = (): ResponsiveBreakpoints => {
  const [dimensions, setDimensions] = useState<ScreenDimensions>(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const isMobile = dimensions.width < BREAKPOINTS.mobile;
  const isTablet = dimensions.width >= BREAKPOINTS.mobile && dimensions.width < BREAKPOINTS.tablet;
  const isDesktop = dimensions.width >= BREAKPOINTS.tablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenWidth: dimensions.width,
    screenHeight: dimensions.height,
  };
};

export default useResponsive;
