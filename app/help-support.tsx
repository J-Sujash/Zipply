import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  ArrowLeftIcon,
  MailIcon,
  PhoneIcon,
  MessageCircleIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  UserIcon,
  CarIcon,
  StarIcon,
  BellIcon,
} from '../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'rides' | 'safety' | 'account';
}

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  items: string[];
}

export default function HelpSupportScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'How do I book a ride?',
      answer: 'To book a ride, go to the Home tab, search for rides by entering your departure and destination locations, select a ride that fits your schedule, and tap "Request to Join". The driver will review your request and either approve or decline it.',
      category: 'rides'
    },
    {
      id: '2',
      question: 'How do I create a ride as a driver?',
      answer: 'Tap the "+" button on the Home screen, fill in your ride details including departure/destination locations, date, time, available seats, and price per seat. Add any requirements or preferences, then publish your ride.',
      category: 'rides'
    },
    {
      id: '3',
      question: 'How does the rating system work?',
      answer: 'After completing a ride, both drivers and passengers can rate each other on a 1-5 star scale. You have 48 hours after the ride to submit ratings. Your overall rating is the average of all ratings you\'ve received.',
      category: 'general'
    },
    {
      id: '4',
      question: 'What safety measures are in place?',
      answer: 'Zipply requires university email verification, displays user ratings and ride history, allows in-app messaging, and provides emergency contact features. Always meet in public places and trust your instincts.',
      category: 'safety'
    },
    {
      id: '5',
      question: 'How do I get verified?',
      answer: 'Verification is automatic when you sign up with a valid university email address. The verification badge appears on your profile once confirmed. This helps build trust within the university community.',
      category: 'account'
    },
    {
      id: '6',
      question: 'Can I cancel a ride?',
      answer: 'Yes, you can cancel rides you\'ve created or bookings you\'ve made. Go to your ride history, find the ride, and select cancel. Please cancel as early as possible to be considerate of other users.',
      category: 'rides'
    },
    {
      id: '7',
      question: 'How do notifications work?',
      answer: 'You\'ll receive notifications for ride requests, booking confirmations, ride reminders, and messages. You can manage notification preferences in your profile settings.',
      category: 'general'
    },
    {
      id: '8',
      question: 'What if I have an issue with another user?',
      answer: 'If you experience any issues with another user, you can report them through the app or contact our support team. We take safety and community guidelines seriously.',
      category: 'safety'
    }
  ];

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      description: 'Learn the basics of using Zipply',
      items: [
        'Create your profile with university email',
        'Add your vehicle information (for drivers)',
        'Set up your preferences and notifications',
        'Complete your profile for better trust'
      ]
    },
    {
      id: 'booking-rides',
      title: 'Booking Rides',
      icon: '🎒',
      description: 'How to find and join rides as a passenger',
      items: [
        'Search for rides by location and date',
        'Filter results by price, time, and preferences',
        'Send booking requests with pickup details',
        'Communicate with drivers through in-app chat'
      ]
    },
    {
      id: 'offering-rides',
      title: 'Offering Rides',
      icon: '🚗',
      description: 'Create and manage rides as a driver',
      items: [
        'Post rides with detailed information',
        'Set pickup/dropoff locations and requirements',
        'Review and approve passenger requests',
        'Manage your vehicle and ride history'
      ]
    },
    {
      id: 'safety-tips',
      title: 'Safety & Trust',
      icon: '🛡️',
      description: 'Stay safe while ridesharing',
      items: [
        'Always verify user profiles and ratings',
        'Meet in well-lit, public areas',
        'Share ride details with friends/family',
        'Trust your instincts and report issues'
      ]
    }
  ];

  const categories = [
    { id: 'all', label: 'All', icon: '📋' },
    { id: 'general', label: 'General', icon: '❓' },
    { id: 'rides', label: 'Rides', icon: '🚗' },
    { id: 'safety', label: 'Safety', icon: '🛡️' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

  const filteredFAQs = selectedCategory === 'all' 
    ? faqData 
    : faqData.filter(faq => faq.category === selectedCategory);

  const handleContactSupport = (method: 'email' | 'phone') => {
    if (method === 'email') {
      Linking.openURL('mailto:support@zipply.app?subject=Zipply Support Request');
    } else {
      Alert.alert(
        'Contact Support',
        'For immediate assistance, please email us at support@zipply.app or use the in-app feedback feature.',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeftIcon size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <Card variant="elevated" style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome to Zipply! 👋</Text>
          <Text style={styles.welcomeText}>
            Your university ridesharing companion. Find rides, share costs, and connect with fellow students safely and easily.
          </Text>
        </Card>

        {/* Quick Actions */}
        <Card variant="elevated" style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Need Quick Help?</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionItem}
              onPress={() => handleContactSupport('email')}
            >
              <MailIcon size={24} color={Colors.primary} />
              <Text style={styles.quickActionText}>Email Support</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionItem}
              onPress={() => router.push('/feedback')}
            >
              <MessageCircleIcon size={24} color={Colors.primary} />
              <Text style={styles.quickActionText}>Send Feedback</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Help Sections */}
        <Card variant="elevated" style={styles.helpSectionsCard}>
          <Text style={styles.sectionTitle}>How to Use Zipply</Text>
          {helpSections.map((section) => (
            <View key={section.id} style={styles.helpSection}>
              <View style={styles.helpSectionHeader}>
                <Text style={styles.helpSectionIcon}>{section.icon}</Text>
                <View style={styles.helpSectionInfo}>
                  <Text style={styles.helpSectionTitle}>{section.title}</Text>
                  <Text style={styles.helpSectionDescription}>{section.description}</Text>
                </View>
              </View>
              <View style={styles.helpSectionItems}>
                {section.items.map((item, index) => (
                  <View key={index} style={styles.helpSectionItem}>
                    <Text style={styles.helpSectionBullet}>•</Text>
                    <Text style={styles.helpSectionItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>

        {/* FAQ Section */}
        <Card variant="elevated" style={styles.faqCard}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {/* Category Filter */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive
                ]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ Items */}
          <View style={styles.faqList}>
            {filteredFAQs.map((faq) => (
              <TouchableOpacity
                key={faq.id}
                style={styles.faqItem}
                onPress={() => toggleFAQ(faq.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqQuestion}>
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Text style={[
                    styles.faqToggle,
                    expandedFAQ === faq.id && styles.faqToggleExpanded
                  ]}>
                    {expandedFAQ === faq.id ? '−' : '+'}
                  </Text>
                </View>
                {expandedFAQ === faq.id && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Contact Section */}
        <Card variant="elevated" style={styles.contactCard}>
          <Text style={styles.sectionTitle}>Still Need Help?</Text>
          <Text style={styles.contactDescription}>
            Can't find what you're looking for? Our support team is here to help!
          </Text>
          
          <Button
            title="📧 Contact Support"
            onPress={() => handleContactSupport('email')}
            style={styles.contactButton}
          />
          
          <Text style={styles.responseTime}>
            We typically respond within 24 hours
          </Text>
        </Card>

        {/* App Info */}
        <Card variant="elevated" style={styles.appInfoCard}>
          <View style={styles.appInfoHeader}>
            <View style={styles.appInfoLogo}>
              <Text style={styles.appInfoLogoText}>Z</Text>
            </View>
            <View style={styles.appInfoHeaderText}>
              <Text style={styles.appInfoTitle}>About Zipply</Text>
              <Text style={styles.appInfoSubtitle}>University Ridesharing</Text>
            </View>
          </View>
          
          <Text style={styles.appInfoDescription}>
            Zipply connects university students for safe, affordable ridesharing. 
            Built by students, for students - fostering community while reducing costs and environmental impact.
          </Text>
          
          <View style={styles.appInfoFeatures}>
            <View style={styles.appInfoFeature}>
              <View style={styles.appInfoFeatureIcon}>
                <Text style={styles.appInfoFeatureEmoji}>🎓</Text>
              </View>
              <View style={styles.appInfoFeatureContent}>
                <Text style={styles.appInfoFeatureTitle}>University Verified</Text>
                <Text style={styles.appInfoFeatureDesc}>Exclusive to verified students</Text>
              </View>
            </View>
            
            <View style={styles.appInfoFeature}>
              <View style={styles.appInfoFeatureIcon}>
                <Text style={styles.appInfoFeatureEmoji}>🛡️</Text>
              </View>
              <View style={styles.appInfoFeatureContent}>
                <Text style={styles.appInfoFeatureTitle}>Safe & Secure</Text>
                <Text style={styles.appInfoFeatureDesc}>Ratings, verification & safety features</Text>
              </View>
            </View>
            
            <View style={styles.appInfoFeature}>
              <View style={styles.appInfoFeatureIcon}>
                <Text style={styles.appInfoFeatureEmoji}>💚</Text>
              </View>
              <View style={styles.appInfoFeatureContent}>
                <Text style={styles.appInfoFeatureTitle}>Eco-Friendly</Text>
                <Text style={styles.appInfoFeatureDesc}>Reduce carbon footprint together</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.appInfoFooter}>
            <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
            <Text style={styles.appInfoCopyright}>© 2024 Zipply. Made with ❤️ for students.</Text>
          </View>
        </Card>
      </ScrollView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  welcomeCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  welcomeTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  quickActionsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  helpSectionsCard: {
    marginBottom: Spacing.lg,
  },
  helpSection: {
    marginBottom: Spacing.lg,
  },
  helpSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  helpSectionIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  helpSectionInfo: {
    flex: 1,
  },
  helpSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  helpSectionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  helpSectionItems: {
    marginLeft: 36,
  },
  helpSectionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  helpSectionBullet: {
    fontSize: FontSize.md,
    color: Colors.primary,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  helpSectionItemText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  faqCard: {
    marginBottom: Spacing.lg,
  },
  categoryFilter: {
    marginBottom: Spacing.lg,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  categoryText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.white,
  },
  faqList: {
    gap: Spacing.sm,
  },
  faqItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  faqToggle: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  faqToggleExpanded: {
    transform: [{ rotate: '0deg' }],
  },
  faqAnswer: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactCard: {
    marginBottom: Spacing.lg,
  },
  contactDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  contactButton: {
    marginBottom: Spacing.sm,
  },
  responseTime: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  appInfoCard: {
    marginBottom: Spacing.lg,
  },
  appInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appInfoLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appInfoLogoText: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  appInfoHeaderText: {
    flex: 1,
  },
  appInfoTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  appInfoSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  appInfoDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  appInfoFeatures: {
    marginBottom: Spacing.xl,
  },
  appInfoFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  appInfoFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appInfoFeatureEmoji: {
    fontSize: 20,
  },
  appInfoFeatureContent: {
    flex: 1,
    paddingTop: Spacing.xs,
  },
  appInfoFeatureTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  appInfoFeatureDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  appInfoFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  appInfoVersion: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  appInfoCopyright: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
