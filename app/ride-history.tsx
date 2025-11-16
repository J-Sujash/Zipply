import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
    ArrowLeftIcon,
    CalendarIcon,
    CarIcon,
    ClockIcon,
    UsersIcon
} from '../components/ui/Icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/Colors';

interface RideHistoryItem {
  id: string;
  title: string;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  pricePerSeat: number;
  totalSeats: number;
  status: 'completed' | 'cancelled';
  role: 'driver' | 'passenger';
  seatsBooked?: number;
  driverName?: string;
  passengerCount?: number;
}

// Helper function to check if ride is within 48-hour rating window
const isWithin48Hours = (departureDate: string, departureTime: string): boolean => {
  try {
    const [year, month, day] = departureDate.split('-').map(Number);
    const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
    
    const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
    const now = new Date();
    const timeSinceRide = now.getTime() - rideDateTime.getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    
    // Must be after the ride time and within 48 hours
    return timeSinceRide >= 0 && timeSinceRide <= fortyEightHours;
  } catch (error) {
    console.log(`❌ Error checking 48-hour window: ${departureDate} ${departureTime}`, error);
    return false;
  }
};

interface MonthGroup {
  monthYear: string;
  displayName: string;
  rides: RideHistoryItem[];
  isExpanded: boolean;
}

export default function RideHistoryScreen() {
  const { user } = useAuth();
  const [rideHistory, setRideHistory] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'driver' | 'passenger'>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRideHistory();
  }, [user]);

  const fetchRideHistory = async () => {
    if (!user) return;

    try {
      setError(null);
      
      // Fetch ALL rides where user was the driver (we'll filter by time later)
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select(`
          id,
          title,
          departure_location,
          destination_location,
          departure_date,
          departure_time,
          price_per_seat,
          total_seats,
          status
        `)
        .eq('driver_id', user.id);

      if (driverError) throw driverError;

      // Fetch ALL rides where user was a passenger (approved requests)
      const { data: passengerRides, error: passengerError } = await supabase
        .from('ride_requests')
        .select(`
          id,
          seats_requested,
          rides!inner (
            id,
            title,
            departure_location,
            destination_location,
            departure_date,
            departure_time,
            price_per_seat,
            total_seats,
            status,
            driver_id
          )
        `)
        .eq('passenger_id', user.id)
        .eq('status', 'approved');

      if (passengerError) throw passengerError;

      // Get driver names for passenger rides
      let passengerRidesWithDrivers: any[] = [];
      if (passengerRides && passengerRides.length > 0) {
        const driverIds = passengerRides.map((r: any) => r.rides.driver_id);
        const { data: drivers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', driverIds);

        passengerRidesWithDrivers = passengerRides.map((request: any) => ({
          ...request,
          driverInfo: drivers?.find((d: any) => d.id === request.rides.driver_id)
        }));
      }

      // Helper function to check if a ride has passed its departure time (using local timezone)
      const isRidePast = (departureDate: string, departureTime: string): boolean => {
        try {
          // Parse the date and time properly (local timezone)
          const [year, month, day] = departureDate.split('-').map(Number);
          const [hours, minutes, seconds = 0] = departureTime.split(':').map(Number);
          
          const rideDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          const now = new Date();
          
          const isPast = rideDateTime < now;
          console.log(`🕐 HISTORY: ${departureDate} ${departureTime} -> ${isPast ? 'PAST' : 'FUTURE'}`);
          return isPast;
        } catch (error) {
          console.log(`❌ Error parsing date: ${departureDate} ${departureTime}`, error);
          return false;
        }
      };

      // Helper function to determine ride status for history
      const getRideHistoryStatus = (dbStatus: string, departureDate: string, departureTime: string): 'completed' | 'cancelled' => {
        if (dbStatus === 'cancelled') return 'cancelled';
        if (dbStatus === 'completed') return 'completed';
        
        // If ride has passed its time but is still marked as active, consider it completed
        if (dbStatus === 'active' && isRidePast(departureDate, departureTime)) {
          return 'completed';
        }
        
        // For other statuses, default to completed if past, otherwise don't include
        return isRidePast(departureDate, departureTime) ? 'completed' : 'completed';
      };

      // Transform and filter data - only include past rides or explicitly completed/cancelled rides
      console.log('🔍 All driver rides:', driverRides?.length || 0);
      console.log('🔍 All passenger rides:', passengerRidesWithDrivers?.length || 0);
      
      const driverHistory: RideHistoryItem[] = (driverRides || [])
        .filter(ride => {
          const isPast = isRidePast(ride.departure_date, ride.departure_time);
          const shouldInclude = ride.status === 'completed' || 
                               ride.status === 'cancelled' || 
                               isPast;
          
          console.log(`🚗 Driver ride ${ride.id}: status=${ride.status}, isPast=${isPast}, shouldInclude=${shouldInclude}, date=${ride.departure_date} ${ride.departure_time}`);
          
          return shouldInclude;
        })
        .map(ride => ({
          id: ride.id,
          title: ride.title,
          departureLocation: ride.departure_location,
          destinationLocation: ride.destination_location,
          departureDate: ride.departure_date,
          departureTime: ride.departure_time,
          pricePerSeat: ride.price_per_seat,
          totalSeats: ride.total_seats,
          status: getRideHistoryStatus(ride.status, ride.departure_date, ride.departure_time),
          role: 'driver' as const,
          passengerCount: ride.total_seats - 1, // Passenger capacity (excluding driver)
        }));

      const passengerHistory: RideHistoryItem[] = (passengerRidesWithDrivers || [])
        .filter(request => {
          const isPast = isRidePast(request.rides.departure_date, request.rides.departure_time);
          const shouldInclude = request.rides.status === 'completed' || 
                               request.rides.status === 'cancelled' || 
                               isPast;
          
          console.log(`🎒 Passenger ride ${request.rides.id}: status=${request.rides.status}, isPast=${isPast}, shouldInclude=${shouldInclude}, date=${request.rides.departure_date} ${request.rides.departure_time}`);
          
          return shouldInclude;
        })
        .map(request => ({
          id: request.rides.id,
          title: request.rides.title,
          departureLocation: request.rides.departure_location,
          destinationLocation: request.rides.destination_location,
          departureDate: request.rides.departure_date,
          departureTime: request.rides.departure_time,
          pricePerSeat: request.rides.price_per_seat,
          totalSeats: request.rides.total_seats,
          status: getRideHistoryStatus(request.rides.status, request.rides.departure_date, request.rides.departure_time),
          role: 'passenger' as const,
          seatsBooked: request.seats_requested,
          driverName: request.driverInfo ? `${request.driverInfo.first_name} ${request.driverInfo.last_name}` : 'Unknown Driver',
        }));

      console.log('📊 Final driver history count:', driverHistory.length);
      console.log('📊 Final passenger history count:', passengerHistory.length);

      // Combine and sort by date
      const allRides = [...driverHistory, ...passengerHistory].sort((a, b) => {
        const dateA = new Date(`${a.departureDate} ${a.departureTime}`);
        const dateB = new Date(`${b.departureDate} ${b.departureTime}`);
        return dateB.getTime() - dateA.getTime();
      });

      setRideHistory(allRides);
      
      // Auto-expand the most recent month if we have rides
      if (allRides.length > 0) {
        const [year, month] = allRides[0].departureDate.split('-');
        const mostRecentMonth = `${year}-${month}`;
        setExpandedMonths(new Set([mostRecentMonth]));
      }
    } catch (error) {
      console.error('Error fetching ride history:', error);
      setError('Failed to load ride history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRideHistory();
  };

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const filteredRides = rideHistory.filter(ride => {
    if (filter === 'all') return true;
    return ride.role === filter;
  });

  // Group rides by month and year
  const groupRidesByMonth = (rides: RideHistoryItem[]): MonthGroup[] => {
    const groups: { [key: string]: RideHistoryItem[] } = {};
    
    rides.forEach(ride => {
      const [year, month] = ride.departureDate.split('-');
      const monthYear = `${year}-${month}`;
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(ride);
    });

    return Object.entries(groups)
      .map(([monthYear, rides]) => {
        const [year, month] = monthYear.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const displayName = date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });

        return {
          monthYear,
          displayName,
          rides: rides.sort((a, b) => {
            const dateA = new Date(`${a.departureDate} ${a.departureTime}`);
            const dateB = new Date(`${b.departureDate} ${b.departureTime}`);
            return dateB.getTime() - dateA.getTime();
          }),
          isExpanded: expandedMonths.has(monthYear)
        };
      })
      .sort((a, b) => b.monthYear.localeCompare(a.monthYear)); // Sort by newest first
  };

  const toggleMonth = (monthYear: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthYear)) {
      newExpanded.delete(monthYear);
    } else {
      newExpanded.add(monthYear);
    }
    setExpandedMonths(newExpanded);
  };

  const groupedRides = groupRidesByMonth(filteredRides);

  const renderMonthHeader = (group: MonthGroup) => (
    <TouchableOpacity
      key={group.monthYear}
      style={styles.monthHeader}
      onPress={() => toggleMonth(group.monthYear)}
      activeOpacity={0.7}
    >
      <View style={styles.monthHeaderContent}>
        <View style={styles.monthInfo}>
          <Text style={styles.monthTitle}>{group.displayName}</Text>
          <Text style={styles.monthCount}>
            {group.rides.length} ride{group.rides.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.monthToggle}>
          <Animated.View
            style={[
              styles.chevron,
              {
                transform: [{
                  rotate: group.isExpanded ? '90deg' : '0deg'
                }]
              }
            ]}
          >
            <Text style={styles.chevronText}>›</Text>
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRideCard = (ride: RideHistoryItem) => (
    <Card key={ride.id} variant="elevated" style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <View style={styles.roleContainer}>
          <View style={[
            styles.roleBadge,
            { backgroundColor: ride.role === 'driver' ? Colors.primary : '#10B981' }
          ]}>
            <Text style={styles.roleText}>
              {ride.role === 'driver' ? '🚗 Driver' : '🎒 Passenger'}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: ride.status === 'completed' ? '#10B981' : '#EF4444' }
          ]}>
            <Text style={styles.statusText}>
              {ride.status === 'completed' ? '✅ Completed' : '❌ Cancelled'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.rideTitle}>{ride.title}</Text>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>{ride.departureLocation}</Text>
        </View>
        <View style={styles.locationConnector} />
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: Colors.error }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>{ride.destinationLocation}</Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailRow}>
          <CalendarIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(ride.departureDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <ClockIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(ride.departureTime)}</Text>
        </View>
        <View style={styles.detailRow}>
          <UsersIcon size={14} color={Colors.textSecondary} />
          <Text style={styles.detailText}>
            {ride.role === 'driver' 
              ? `${ride.totalSeats - 1} seats` 
              : `${ride.seatsBooked} seat${ride.seatsBooked! > 1 ? 's' : ''}`
            }
          </Text>
        </View>
      </View>

      {ride.role === 'passenger' && ride.driverName && (
        <View style={styles.driverInfo}>
          <Text style={styles.driverLabel}>👤 Driver:</Text>
          <Text style={styles.driverName}>{ride.driverName}</Text>
        </View>
      )}

      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>
          {ride.role === 'driver' ? '💰 Earned per seat' : '💳 Total paid'}
        </Text>
        <Text style={styles.priceValue}>
          ${ride.role === 'driver' 
            ? ride.pricePerSeat.toFixed(2) 
            : (ride.pricePerSeat * (ride.seatsBooked || 1)).toFixed(2)
          }
        </Text>
      </View>

      {ride.status === 'completed' && isWithin48Hours(ride.departureDate, ride.departureTime) && (
        <View style={styles.actionContainer}>
          <Button
            title="⭐ Rate Ride"
            onPress={() => {
              console.log('🎯 Navigating to rate ride:', ride.id, 'Date:', ride.departureDate, 'Time:', ride.departureTime);
              router.push(`/rate-ride/${ride.id}` as any);
            }}
            variant="outline"
            style={styles.rateButton}
            textStyle={styles.rateButtonText}
          />
        </View>
      )}
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading ride history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Ride History</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterWrapper}>
          {(['all', 'driver', 'passenger'] as const).map((filterOption, index) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.activeFilterButton,
                index === 0 && styles.firstFilterButton,
                index === 2 && styles.lastFilterButton,
              ]}
              onPress={() => setFilter(filterOption)}
              activeOpacity={0.8}
            >
              <View style={styles.filterButtonContent}>
                <Text style={styles.filterIcon}>
                  {filterOption === 'all' ? '📊' : 
                   filterOption === 'driver' ? '🚗' : '🎒'}
                </Text>
                <Text style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.activeFilterButtonText,
                ]}>
                  {filterOption === 'all' ? 'All' : 
                   filterOption === 'driver' ? 'Driver' : 'Passenger'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={fetchRideHistory}
            style={styles.retryButton}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredRides.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <CarIcon size={80} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'No Ride History' : 
                 filter === 'driver' ? 'No Driver History' : 'No Passenger History'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all' 
                  ? "You haven't completed any rides yet. Start by creating or joining a ride!"
                  : filter === 'driver'
                  ? "You haven't driven any rides yet. Create your first ride to get started!"
                  : "You haven't been a passenger on any rides yet. Find a ride to join!"
                }
              </Text>
              <TouchableOpacity 
                style={styles.emptyActionButton}
                onPress={() => router.push('/(tabs)/home')}
              >
                <Text style={styles.emptyActionText}>
                  {filter === 'driver' ? 'Create a Ride' : 'Find Rides'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ridesContainer}>
              {groupedRides.map(group => (
                <View key={group.monthYear} style={styles.monthGroup}>
                  {renderMonthHeader(group)}
                  {group.isExpanded && (
                    <View style={styles.monthRides}>
                      {group.rides.map(renderRideCard)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
  },
  filterWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 3,
    gap: 1,
    alignSelf: 'center',
    maxWidth: Dimensions.get('window').width - (Spacing.lg * 2),
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 48,
    minWidth: 80,
  },
  firstFilterButton: {
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  lastFilterButton: {
    borderTopRightRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  activeFilterButton: {
    backgroundColor: Colors.white,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  filterButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  filterIcon: {
    fontSize: 18,
    marginBottom: 1,
  },
  filterButtonText: {
    fontSize: FontSize.sm - 1,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  activeFilterButtonText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  rideCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  rideHeader: {
    marginBottom: Spacing.md,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  roleText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '600',
  },
  rideTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  locationContainer: {
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationDot: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  locationConnector: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 9,
    marginVertical: 2,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  driverLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  driverName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyActionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyActionText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  ridesContainer: {
    paddingTop: Spacing.sm,
  },
  actionContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rateButton: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  rateButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  monthGroup: {
    marginBottom: Spacing.md,
  },
  monthHeader: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  monthHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    width: '100%',
  },
  monthInfo: {
    flex: 1,
  },
  monthTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  monthCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  monthToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
  monthRides: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
});
