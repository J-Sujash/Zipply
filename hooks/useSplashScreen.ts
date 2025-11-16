import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

export function useSplashScreen() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Keep the native splash screen visible while we prepare the app
        await SplashScreen.preventAutoHideAsync();
        
        // Simulate app loading (you can add your actual loading logic here)
        // For example: loading fonts, checking auth state, etc.
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsAppReady(true);
      } catch (e) {
        console.warn(e);
        setIsAppReady(true);
      }
    }

    prepare();
  }, []);

  const onCustomSplashComplete = async () => {
    setShowCustomSplash(false);
    // Hide the native splash screen after our custom animation completes
    await SplashScreen.hideAsync();
  };

  return {
    isAppReady,
    showCustomSplash,
    onCustomSplashComplete,
  };
}
