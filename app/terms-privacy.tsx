import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

import { Card } from '../components/ui/Card';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  BookOpenIcon,
} from '../components/ui/Icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/Colors';

export default function TermsPrivacyScreen() {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  const tabs = [
    { id: 'terms' as const, label: 'Terms of Service', icon: '📋' },
    { id: 'privacy' as const, label: 'Privacy Policy', icon: '🔒' },
  ];

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
        <Text style={styles.title}>Legal</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
      </ScrollView>
    </SafeAreaView>
  );
}

const TermsOfService = () => (
  <Card variant="elevated" style={styles.legalCard}>
    <View style={styles.legalHeader}>
      <ShieldCheckIcon size={32} color={Colors.primary} />
      <Text style={styles.legalTitle}>Terms of Service</Text>
      <Text style={styles.legalDate}>Last updated: October 19, 2024</Text>
    </View>

    <View style={styles.legalContent}>
      <Text style={styles.legalIntro}>
        These Terms of Service constitute a legally binding agreement between you and Zipply, Inc. ("Zipply," "we," "us," or "our") governing your access to and use of the Zipply mobile application, website, and related services (collectively, the "Service"). By downloading, installing, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and all applicable laws and regulations.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Acceptance and Modification of Terms</Text>
        <Text style={styles.sectionText}>
          By creating an account, accessing, or using any portion of the Service, you expressly agree to these Terms and represent that you are legally capable of entering into binding contracts. If you do not agree to these Terms, you are prohibited from using the Service and must immediately cease all use. We reserve the right, in our sole discretion, to modify, update, or replace these Terms at any time without prior notice. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms. It is your responsibility to review these Terms periodically for updates. We may provide notice of material changes through the Service, by email, or other reasonable means, but are not obligated to do so.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Description of Service and Platform Role</Text>
        <Text style={styles.sectionText}>
          Zipply operates as an intermediary platform that facilitates connections between university students seeking to share transportation. The Service allows users to post ride offers, search for available rides, communicate with other users, and arrange shared transportation. Zipply does not provide transportation services and is not a transportation carrier. We do not own, operate, or control any vehicles used in connection with the Service. Zipply acts solely as a technology platform and marketplace that enables users to connect with each other. All transportation services are provided directly by individual users, and Zipply is not a party to any agreements between users regarding transportation, payment, or any other matters.
        </Text>
        <Text style={styles.sectionText}>
          The Service includes features such as user profiles, ride posting and searching capabilities, in-app messaging, rating and review systems, and related functionality. We may add, modify, or remove features at any time without notice. The availability and functionality of the Service may vary based on your location, device, operating system, and other factors beyond our control.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. User Eligibility and Account Requirements</Text>
        <Text style={styles.sectionText}>
          To use the Service, you must be at least eighteen (18) years of age and currently enrolled as a student at an accredited university or college. You must possess a valid university email address ending in ".edu" or other approved educational domain. For users who wish to offer rides as drivers, you must possess a valid driver's license issued by the jurisdiction in which you will be driving, maintain current vehicle registration, and carry adequate motor vehicle insurance as required by applicable law.
        </Text>
        <Text style={styles.sectionText}>
          You are responsible for providing accurate, current, and complete information during registration and for updating such information as necessary. You may not create multiple accounts, use false or misleading information, or allow others to use your account. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account, whether authorized by you or not. You agree to immediately notify us of any unauthorized use of your account or any other breach of security.
        </Text>
        <Text style={styles.sectionText}>
          We reserve the right to refuse service, terminate accounts, or cancel rides at our sole discretion, including but not limited to situations where we suspect fraudulent activity, violation of these Terms, or behavior that may harm other users or the integrity of the platform.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. User Conduct and Responsibilities</Text>
        <Text style={styles.sectionText}>
          You are solely responsible for your conduct while using the Service and for any consequences thereof. You agree to use the Service only for lawful purposes and in accordance with these Terms and all applicable federal, state, and local laws and regulations. You acknowledge that you are entering into independent arrangements with other users and that Zipply is not a party to such arrangements.
        </Text>
        <Text style={styles.sectionText}>
          You agree not to use the Service to: (a) violate any applicable law, regulation, or these Terms; (b) infringe upon or violate the rights of others; (c) harass, abuse, stalk, threaten, or otherwise harm another person; (d) engage in any discriminatory behavior based on race, gender, religion, nationality, disability, sexual orientation, or age; (e) post or transmit any content that is unlawful, harmful, threatening, abusive, defamatory, vulgar, obscene, or otherwise objectionable; (f) impersonate any person or entity or falsely state or misrepresent your affiliation with any person or entity; (g) interfere with or disrupt the Service or servers or networks connected to the Service; (h) attempt to gain unauthorized access to any portion of the Service or any other systems or networks; (i) use the Service for any commercial purpose without our express written consent; or (j) collect or store personal data about other users without their consent.
        </Text>
        <Text style={styles.sectionText}>
          As a driver, you are solely responsible for: maintaining a valid driver's license and vehicle registration; ensuring your vehicle is safe, roadworthy, and properly insured; complying with all traffic laws and regulations; determining the suitability of passengers; setting appropriate ride terms including pricing, pickup locations, and passenger requirements; and maintaining adequate insurance coverage for yourself, your vehicle, and your passengers. You acknowledge that standard personal auto insurance policies may not cover commercial activities or ridesharing, and you are responsible for obtaining appropriate coverage.
        </Text>
        <Text style={styles.sectionText}>
          As a passenger, you are solely responsible for: evaluating the safety and suitability of drivers and vehicles; making your own decisions about whether to accept rides; following all safety guidelines and instructions from drivers; paying agreed-upon fees in a timely manner; and behaving respectfully toward drivers and other passengers.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Safety Disclaimers and User Assumption of Risk</Text>
        <Text style={styles.sectionText}>
          You acknowledge and agree that using the Service involves inherent risks, including but not limited to the risk of physical harm, property damage, or death. You voluntarily assume all such risks and agree that Zipply cannot and does not guarantee the safety, reliability, or suitability of any user, vehicle, or ride arranged through the Service. While we may provide certain safety features and guidelines, you are solely responsible for your own safety and the safety of others.
        </Text>
        <Text style={styles.sectionText}>
          Zipply does not conduct background checks, verify driving records, inspect vehicles, or otherwise screen users beyond basic email verification. Any ratings, reviews, or other information provided by users may be inaccurate, incomplete, or misleading. You should not rely solely on such information when making decisions about rides or other users. We strongly encourage you to exercise caution, meet in public places, inform others of your plans, and trust your instincts when using the Service.
        </Text>
        <Text style={styles.sectionText}>
          You acknowledge that Zipply has no control over the conduct of users or the condition of vehicles used in connection with the Service. We do not guarantee that users will complete rides as promised, arrive on time, or behave appropriately. You use the Service at your own risk and are encouraged to take appropriate precautions for your safety and security.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Payment Terms and Financial Responsibility</Text>
        <Text style={styles.sectionText}>
          All payment arrangements for rides are made directly between users. Zipply does not process, facilitate, or guarantee any payments between users. You are solely responsible for determining appropriate compensation, collecting or making payments, and resolving any payment disputes. Zipply is not responsible for any failure to pay, disputes over payment amounts, or fraudulent payment activities.
        </Text>
        <Text style={styles.sectionText}>
          Users may incur costs related to using the Service, including but not limited to data usage charges, fuel costs, vehicle wear and tear, insurance deductibles, and parking fees. You are solely responsible for all such costs. Zipply may introduce fees for certain features or services in the future, and we will provide appropriate notice of any such changes.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Intellectual Property Rights</Text>
        <Text style={styles.sectionText}>
          The Service and all content, features, and functionality thereof, including but not limited to text, graphics, logos, images, software, and the selection and arrangement thereof, are owned by Zipply or its licensors and are protected by copyright, trademark, patent, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for your personal, non-commercial use in accordance with these Terms.
        </Text>
        <Text style={styles.sectionText}>
          You retain ownership of any content you submit to the Service, but you grant Zipply a worldwide, royalty-free, sublicensable, transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform such content in connection with the Service and Zipply's business operations. You represent and warrant that you have all rights necessary to grant this license and that your content does not infringe upon the rights of any third party.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>8. Privacy and Data Collection</Text>
        <Text style={styles.sectionText}>
          Your privacy is important to us, and our collection and use of your information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you consent to the collection, use, and disclosure of your information as described in the Privacy Policy. You acknowledge that the Service may not be private or secure and that others may be able to see your profile information, ride history, and other data you choose to share.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>9. Disclaimers of Warranties</Text>
        <Text style={styles.sectionText}>
          THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, ZIPPLY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
        </Text>
        <Text style={styles.sectionText}>
          ZIPPLY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. ZIPPLY DOES NOT WARRANT THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY CONTENT OR INFORMATION AVAILABLE THROUGH THE SERVICE. YOU ACKNOWLEDGE THAT YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>10. Limitation of Liability and Indemnification</Text>
        <Text style={styles.sectionText}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ZIPPLY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF ZIPPLY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </Text>
        <Text style={styles.sectionText}>
          ZIPPLY'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THE SERVICE SHALL NOT EXCEED ONE HUNDRED DOLLARS ($100) OR THE AMOUNT YOU PAID TO ZIPPLY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, WHICHEVER IS LESS.
        </Text>
        <Text style={styles.sectionText}>
          You agree to indemnify, defend, and hold harmless Zipply and its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including attorney's fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third party rights; (d) any rides or interactions with other users; (e) any accidents, injuries, or damages occurring in connection with rides arranged through the Service; and (f) any content you submit to the Service.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>11. Insurance and Risk Allocation</Text>
        <Text style={styles.sectionText}>
          You acknowledge that Zipply does not provide insurance coverage for any activities conducted through the Service. You are solely responsible for obtaining and maintaining appropriate insurance coverage, including but not limited to motor vehicle insurance that covers ridesharing activities. You acknowledge that standard personal auto insurance policies may exclude coverage for commercial activities or carrying passengers for compensation.
        </Text>
        <Text style={styles.sectionText}>
          By using the Service, you acknowledge and agree that you are solely responsible for any and all risks associated with ridesharing, including but not limited to vehicle accidents, personal injury, property damage, theft, and other incidents. You waive any claims against Zipply related to such risks and agree that Zipply shall have no liability for any damages or losses arising from ridesharing activities.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>12. Termination and Suspension</Text>
        <Text style={styles.sectionText}>
          We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including but not limited to breach of these Terms, suspected fraudulent activity, safety concerns, or violation of applicable laws. Upon termination, your right to use the Service will cease immediately, and we may delete your account and all associated data.
        </Text>
        <Text style={styles.sectionText}>
          You may terminate your account at any time by following the account deletion process in the Service. Termination of your account does not relieve you of any obligations or liabilities incurred prior to termination. The provisions of these Terms that by their nature should survive termination shall survive, including but not limited to ownership provisions, warranty disclaimers, indemnity obligations, and limitations of liability.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>13. Dispute Resolution and Arbitration</Text>
        <Text style={styles.sectionText}>
          Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved through binding arbitration rather than in court, except that you may assert claims in small claims court if your claims qualify. The arbitration will be conducted by the American Arbitration Association under its Commercial Arbitration Rules and Mediation Procedures. The arbitration will be held in the state where Zipply is incorporated, and you consent to the jurisdiction and venue of such location.
        </Text>
        <Text style={styles.sectionText}>
          You waive any right to a jury trial and any right to participate in a class action lawsuit or class-wide arbitration. Each party will bear its own costs and attorneys' fees in any arbitration, unless otherwise required by applicable law.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>14. Governing Law and Jurisdiction</Text>
        <Text style={styles.sectionText}>
          These Terms and any disputes arising hereunder shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles. Any legal action or proceeding arising under these Terms will be brought exclusively in the federal or state courts located in Delaware, and you hereby consent to personal jurisdiction and venue therein.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>15. Severability and Entire Agreement</Text>
        <Text style={styles.sectionText}>
          If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall remain in full force and effect. These Terms, together with our Privacy Policy, constitute the entire agreement between you and Zipply regarding the Service and supersede all prior agreements and understandings, whether written or oral.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>16. Contact Information</Text>
        <Text style={styles.sectionText}>
          If you have any questions about these Terms, please contact us at:
        </Text>
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>Zipply, Inc.</Text>
          <Text style={styles.contactText}>Legal Department</Text>
          <Text style={styles.contactText}>Email: legal@zipply.app</Text>
          <Text style={styles.contactText}>Address: [Company Address]</Text>
        </View>
      </View>
    </View>
  </Card>
);

const PrivacyPolicy = () => (
  <Card variant="elevated" style={styles.legalCard}>
    <View style={styles.legalHeader}>
      <ShieldCheckIcon size={32} color={Colors.primary} />
      <Text style={styles.legalTitle}>Privacy Policy</Text>
      <Text style={styles.legalDate}>Last updated: October 19, 2024</Text>
    </View>

    <View style={styles.legalContent}>
      <Text style={styles.legalIntro}>
        This Privacy Policy describes how Zipply collects, uses, and protects your personal information when you use our ridesharing platform.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.sectionSubtitle}>Personal Information:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Name and university email address</Text>
          <Text style={styles.bulletItem}>• Profile picture and bio</Text>
          <Text style={styles.bulletItem}>• University and graduation year</Text>
          <Text style={styles.bulletItem}>• Phone number (optional)</Text>
          <Text style={styles.bulletItem}>• Vehicle information (for drivers)</Text>
        </View>
        
        <Text style={styles.sectionSubtitle}>Usage Information:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Ride history and preferences</Text>
          <Text style={styles.bulletItem}>• Ratings and reviews</Text>
          <Text style={styles.bulletItem}>• App usage patterns</Text>
          <Text style={styles.bulletItem}>• Device information and IP address</Text>
        </View>

        <Text style={styles.sectionSubtitle}>Location Information:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Pickup and dropoff locations</Text>
          <Text style={styles.bulletItem}>• General location for ride matching</Text>
          <Text style={styles.bulletItem}>• Location data is only collected when using the app</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.sectionText}>We use your information to:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Facilitate ridesharing connections</Text>
          <Text style={styles.bulletItem}>• Verify university student status</Text>
          <Text style={styles.bulletItem}>• Improve app functionality and user experience</Text>
          <Text style={styles.bulletItem}>• Send important notifications about rides</Text>
          <Text style={styles.bulletItem}>• Ensure platform safety and security</Text>
          <Text style={styles.bulletItem}>• Provide customer support</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Information Sharing</Text>
        <Text style={styles.sectionText}>
          We share limited information to facilitate ridesharing:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Profile information with potential ride matches</Text>
          <Text style={styles.bulletItem}>• Contact information with confirmed ride partners</Text>
          <Text style={styles.bulletItem}>• Ratings and reviews (anonymized when appropriate)</Text>
        </View>
        <Text style={styles.sectionText}>
          We do not sell your personal information to third parties.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.sectionText}>
          We implement industry-standard security measures:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Encrypted data transmission and storage</Text>
          <Text style={styles.bulletItem}>• Secure authentication systems</Text>
          <Text style={styles.bulletItem}>• Regular security audits and updates</Text>
          <Text style={styles.bulletItem}>• Limited access to personal information</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Your Privacy Rights</Text>
        <Text style={styles.sectionText}>You have the right to:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Access your personal information</Text>
          <Text style={styles.bulletItem}>• Update or correct your profile</Text>
          <Text style={styles.bulletItem}>• Delete your account and associated data</Text>
          <Text style={styles.bulletItem}>• Control notification preferences</Text>
          <Text style={styles.bulletItem}>• Request data portability</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Data Retention</Text>
        <Text style={styles.sectionText}>
          We retain your information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain information for legal compliance and safety purposes for up to 7 years.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
        <Text style={styles.sectionText}>
          Zipply is designed for university students aged 18 and older. We do not knowingly collect information from individuals under 18 years of age.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
        <Text style={styles.sectionText}>
          Our app may integrate with third-party services for:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Maps and navigation</Text>
          <Text style={styles.bulletItem}>• Analytics and crash reporting</Text>
          <Text style={styles.bulletItem}>• Push notifications</Text>
        </View>
        <Text style={styles.sectionText}>
          These services have their own privacy policies that govern their use of your information.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>9. International Users</Text>
        <Text style={styles.sectionText}>
          Zipply is primarily designed for US university students. If you use our service from outside the US, your information may be transferred to and processed in the United States.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>10. Changes to Privacy Policy</Text>
        <Text style={styles.sectionText}>
          We may update this Privacy Policy periodically. We will notify users of significant changes through the app and update the "Last updated" date above.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.sectionText}>
          For privacy-related questions or requests:
        </Text>
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>Privacy Officer: privacy@zipply.app</Text>
          <Text style={styles.contactText}>General Support: support@zipply.app</Text>
          <Text style={styles.contactText}>Data Requests: data@zipply.app</Text>
        </View>
      </View>
    </View>
  </Card>
);

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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  tabTextActive: {
    color: Colors.white,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  legalCard: {
    marginTop: Spacing.lg,
  },
  legalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legalTitle: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  legalDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  legalContent: {
    paddingHorizontal: Spacing.sm,
  },
  legalIntro: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: FontSize.md,
    fontWeight: 'normal',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  bulletList: {
    marginLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bulletItem: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  contactInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  contactText: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
});
