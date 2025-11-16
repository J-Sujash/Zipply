import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import {
    HomeIcon,
    ListIcon,
    PlusIcon,
    SearchIcon,
    UserIcon,
} from '../../components/ui/Icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { user, loading } = useAuth();

  console.log('🏠 TabLayout state:', { loading, hasUser: !!user, userId: user?.id });

  // If still loading auth state, show nothing (let root handle loading UI)
  if (loading) {
    console.log('🏠 TabLayout: Still loading, showing null');
    return null;
  }

  // If no user, redirect to login
  if (!user) {
    console.log('🏠 TabLayout: No user, redirecting to login');
    return <Redirect href="/auth/login" />;
  }

  console.log('🏠 TabLayout: User authenticated, showing tabs');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 28,
          marginHorizontal: 12,
          marginBottom: 20,
          paddingTop: 15,
          paddingBottom: 15,
          height: 88,
          position: 'absolute',
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 8,
          borderWidth: 0,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="light"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                borderRadius: 28,
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            />
          ) : (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                borderRadius: 28,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            />
          )
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <HomeIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <SearchIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size }) => (
            <PlusIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => (
            <ListIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <UserIcon size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
