import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

import { Card } from '../../components/ui/Card';
import {
    CalendarIcon,
    CarIcon,
    PlusIcon,
    SearchIcon,
    TimeIcon,
    UserIcon,
    UsersIcon
} from '../../components/ui/Icons';
import { MessageIconWithBadge } from '../../components/ui/MessageIcon';
import { NotificationIcon } from '../../components/ui/NotificationIcon';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/Colors';

const { width } = Dimensions.get('window');

interface QuickStat {
  id: string;
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

interface RecentRide {
  id: string;
  title: string;
  type: 'driver' | 'passenger';
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  status: 'completed' | 'upcoming' | 'cancelled';
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  date: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (user) {
      fetchHomeData();
    }
  }, [user]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUserProfile(),
        fetchQuickStats(),
        fetchRecentRides(),
        fetchAnnouncements(),
      ]);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setUserName(data ? `${data.first_name} ${data.last_name}` : 'Student');
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserName('Student');
    }
  };

  const fetchQuickStats = async () => {
    try {
      // Fetch rides offered by user
      const { data: offeredRides, error: offeredError } = await supabase
        .from('rides')
        .select('id, status')
        .eq('driver_id', user?.id);

      if (offeredError) throw offeredError;

      // Fetch rides requested by user
      const { data: requestedRides, error: requestedError } = await supabase
        .from('ride_requests')
        .select('id, status')
        .eq('passenger_id', user?.id);

      if (requestedError) throw requestedError;

      // Fetch available rides
      const { data: availableRides, error: availableError } = await supabase
        .from('rides')
        .select('id')
        .eq('status', 'active')
        .gt('available_seats', 0)
        .neq('driver_id', user?.id || '');

      if (availableError) throw availableError;

      const stats: QuickStat[] = [
        {
          id: '1',
          title: 'Rides Offered',
          value: (offeredRides?.length || 0).toString(),
          icon: <CarIcon size={24} color={Colors.primary} />,
          color: Colors.primary,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '2',
          title: 'Rides Requested',
          value: (requestedRides?.length || 0).toString(),
          icon: <UserIcon size={24} color={Colors.success} />,
          color: Colors.success,
          onPress: () => router.push('/(tabs)/requests'),
        },
        {
          id: '3',
          title: 'Available Rides',
          value: (availableRides?.length || 0).toString(),
          icon: <SearchIcon size={24} color={Colors.warning} />,
          color: Colors.warning,
          onPress: () => router.push('/(tabs)/search'),
        },
        {
          id: '4',
          title: 'Total Connections',
          value: ((offeredRides?.length || 0) + (requestedRides?.length || 0)).toString(),
          icon: <UsersIcon size={24} color={Colors.error} />,
          color: Colors.error,
          onPress: () => router.push('/ride-history'),
        },
      ];

      setQuickStats(stats);
    } catch (error) {
      console.error('Error fetching quick stats:', error);
    }
  };

  const fetchRecentRides = async () => {
    try {
      // Helper function to check if a ride is in the future (using local timezone)
      const isRideFuture = (departureDate: string, departureTime: string): boolean => {
        try {
          // Parse the date and time properly (local timezone)
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          const now = new Date();
          
          const isFuture = rideDateTime > now;
          console.log(`🕐 HOME: ${departureDate} ${departureTime} -> ${isFuture ? 'FUTURE' : 'PAST'}`);
          return isFuture;
        } catch (error) {
          console.log(`❌ Error parsing date: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // Fetch recent rides as driver
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('id, title, departure_location, destination_location, departure_date, departure_time, status')
        .eq('driver_id', user?.id)
        .limit(10); // Get more to filter

      if (driverError) throw driverError;

      // Fetch recent rides as passenger
      const { data: passengerRides, error: passengerError } = await supabase
        .from('ride_requests')
        .select(`
          id,
          status,
          ride:rides (
            id,
            title,
            departure_location,
            destination_location,
            departure_date,
            departure_time,
            status
          )
        `)
        .eq('passenger_id', user?.id)
        .eq('status', 'approved')
        .limit(10); // Get more to filter

      if (passengerError) throw passengerError;

      const formattedDriverRides: RecentRide[] = (driverRides || [])
        .filter((ride: any) => isRideFuture(ride.departure_date, ride.departure_time)) // Only future rides
        .map((ride: any) => ({
          id: ride.id,
          title: ride.title,
          type: 'driver' as const,
          departureLocation: ride.departure_location,
          destinationLocation: ride.destination_location,
          departureDate: ride.departure_date,
          departureTime: ride.departure_time,
          status: ride.status === 'active' ? 'upcoming' : 'completed',
        }));

      const formattedPassengerRides: RecentRide[] = (passengerRides || [])
        .filter((request: any) => request.ride && isRideFuture(request.ride.departure_date, request.ride.departure_time)) // Only future rides
        .map((request: any) => ({
          id: request.ride.id,
          title: request.ride.title,
          type: 'passenger' as const,
          departureLocation: request.ride.departure_location,
          destinationLocation: request.ride.destination_location,
          departureDate: request.ride.departure_date,
          departureTime: request.ride.departure_time,
          status: request.ride.status === 'active' ? 'upcoming' : 'completed',
        }));

      const allRides = [...formattedDriverRides, ...formattedPassengerRides]
        .sort((a, b) => {
          // Create full datetime objects for accurate sorting
          const dateTimeA = new Date(`${a.departureDate}T${a.departureTime}`);
          const dateTimeB = new Date(`${b.departureDate}T${b.departureTime}`);
          return dateTimeA.getTime() - dateTimeB.getTime(); // Sort by earliest date/time first
        })
        .slice(0, 5);

      setRecentRides(allRides);
    } catch (error) {
      console.error('Error fetching recent rides:', error);
    }
  };

  const fetchAnnouncements = async () => {
    // Mock announcements for now - in a real app, these would come from a database
    const mockAnnouncements: Announcement[] = [
      {
        id: '1',
        title: '🎉 Welcome to Zipply!',
        message: 'Connect with fellow students and share rides safely and affordably.',
        type: 'success',
        date: new Date().toISOString(),
      },
      {
        id: '2',
        title: '🚗 Safety First',
        message: 'Always verify driver details and share your trip with friends.',
        type: 'info',
        date: new Date().toISOString(),
      },
      {
        id: '3',
        title: '💰 Save Money',
        message: 'Split gas costs and reduce your carbon footprint by carpooling.',
        type: 'warning',
        date: new Date().toISOString(),
      },
    ];

    setAnnouncements(mockAnnouncements);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHomeData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return Colors.primary;
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '🚗';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '📅';
    }
  };

  const getAnnouncementColor = (type: string) => {
    switch (type) {
      case 'success':
        return Colors.success;
      case 'warning':
        return Colors.warning;
      case 'info':
        return Colors.primary;
      default:
        return Colors.textSecondary;
    }
  };

  const renderQuickStat = ({ item }: { item: QuickStat }) => (
    <TouchableOpacity onPress={item.onPress} style={styles.statCard}>
      <Card variant="outlined" style={StyleSheet.flatten([styles.statCardInner, { borderLeftColor: item.color }])}>
        <View style={styles.statIcon}>
          {item.icon}
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statTitle}>{item.title}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderRecentRide = ({ item }: { item: RecentRide }) => (
    <TouchableOpacity onPress={() => router.push(`/ride/${item.id}`)} style={styles.rideCard}>
      <Card variant="outlined" style={styles.rideCardInner}>
        <View style={styles.rideHeader}>
          <View style={styles.rideTypeContainer}>
            <View style={[styles.rideTypeBadge, { backgroundColor: item.type === 'driver' ? Colors.primary + '20' : Colors.success + '20' }]}>
              <Text style={[styles.rideTypeText, { color: item.type === 'driver' ? Colors.primary : Colors.success }]}>
                {item.type === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusEmoji(item.status)} {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.rideTitle}>{item.title}</Text>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.departureLocation}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.locationText} numberOfLines={1}>{item.destinationLocation}</Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <CalendarIcon size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={styles.detailItem}>
            <TimeIcon size={14} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{formatTime(item.departureTime)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderAnnouncement = ({ item }: { item: Announcement }) => (
    <Card variant="outlined" style={StyleSheet.flatten([styles.announcementCard, { borderLeftColor: getAnnouncementColor(item.type) }])}>
      <Text style={styles.announcementTitle}>{item.title}</Text>
      <Text style={styles.announcementMessage}>{item.message}</Text>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName}! 👋</Text>
            </View>
            <View style={styles.headerIcons}>
              <MessageIconWithBadge size={24} color={Colors.text} />
              <NotificationIcon size={24} color={Colors.text} />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.primary }]}
              onPress={() => router.push('/(tabs)/search')}
            >
              <SearchIcon size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Find Rides</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.success }]}
              onPress={() => router.push('/(tabs)/create')}
            >
              <PlusIcon size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Offer Ride</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          <FlatList
            data={quickStats}
            renderItem={renderQuickStat}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
          />
        </View>

        {/* Upcoming Rides */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Rides</Text>
          {recentRides.length > 0 ? (
            <FlatList
              data={recentRides}
              renderItem={renderRecentRide}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ridesContainer}
            />
          ) : (
            <Card variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptyText}>Start by searching for rides or offering one!</Text>
            </Card>
          )}
        </View>

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campus Updates</Text>
          <FlatList
            data={announcements}
            renderItem={renderAnnouncement}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    width: width * 0.4,
  },
  statCardInner: {
    padding: Spacing.lg,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    marginRight: Spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  ridesContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  rideCard: {
    width: width * 0.75,
  },
  rideCardInner: {
    padding: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rideHeader: {
    marginBottom: Spacing.md,
  },
  rideTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rideTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  rideTypeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  rideTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  routeContainer: {
    marginBottom: Spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 3,
    marginVertical: Spacing.xs,
  },
  locationText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  announcementCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  announcementTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  announcementMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emptyCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
