import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="home-outline" size={size} color={color} />
);

export const CarIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="car-outline" size={size} color={color} />
);

export const PlusIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="add" size={size} color={color} />
);

export const ListIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="list-outline" size={size} color={color} />
);

export const UserIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="person-outline" size={size} color={color} />
);

export const SearchIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="search-outline" size={size} color={color} />
);

export const LocationIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="location-outline" size={size} color={color} />
);

export const TimeIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="time-outline" size={size} color={color} />
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="calendar-outline" size={size} color={color} />
);

export const EyeIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="eye-outline" size={size} color={color} />
);

export const EyeOffIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="eye-off-outline" size={size} color={color} />
);

export const MailIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="mail-outline" size={size} color={color} />
);

export const LockIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="lock-closed-outline" size={size} color={color} />
);

export const CheckIcon: React.FC<IconProps> = ({ size = 24, color = Colors.success }) => (
  <Ionicons name="checkmark-circle-outline" size={size} color={color} />
);

export const XIcon: React.FC<IconProps> = ({ size = 24, color = Colors.error }) => (
  <Ionicons name="close-circle-outline" size={size} color={color} />
);

export const SchoolIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="school-outline" size={size} color={color} />
);

export const BirthdayIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="gift-outline" size={size} color={color} />
);

export const GenderIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="person-outline" size={size} color={color} />
);

export const DescriptionIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="document-text-outline" size={size} color={color} />
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="arrow-back" size={size} color={color} />
);

export const MapPinIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="location-outline" size={size} color={color} />
);

export const ClockIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="time-outline" size={size} color={color} />
);

export const UsersIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="people-outline" size={size} color={color} />
);

export const MessageIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="chatbubble-outline" size={size} color={color} />
);

export const StarIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary, filled = false }) => (
  <Ionicons name={filled ? "star" : "star-outline"} size={size} color={color} />
);

export const PhoneIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="call-outline" size={size} color={color} />
);

export const FilterIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="options-outline" size={size} color={color} />
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="chevron-down" size={size} color={color} />
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="chevron-up" size={size} color={color} />
);

export const SunIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="sunny-outline" size={size} color={color} />
);

export const MoonIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="moon-outline" size={size} color={color} />
);

export const ClockOutlineIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="time-outline" size={size} color={color} />
);

export const BellIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="notifications-outline" size={size} color={color} />
);

export const EditIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="create-outline" size={size} color={color} />
);

export const TrashIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="trash-outline" size={size} color={color} />
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="settings-outline" size={size} color={color} />
);

export const GraduationCapIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="school" size={size} color={color} />
);

export const ShieldCheckIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="shield-checkmark-outline" size={size} color={color} />
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = 24, color = Colors.success }) => (
  <Ionicons name="checkmark-circle" size={size} color={color} />
);

export const MessageCircleIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
);

export const BookOpenIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="book-outline" size={size} color={color} />
);

export const DollarIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Ionicons name="cash-outline" size={size} color={color} />
);

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});
