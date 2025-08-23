import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from '@/components';
import { useAuthContext } from '@/utils';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@/constants';

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuthContext();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* User Profile */}
        <Card style={styles.card}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={32} color={COLORS.white} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>{user?.role}</Text>
            </View>
          </View>
        </Card>

        {/* App Settings */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          
          <SettingItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Configure push notifications"
            onPress={() => console.log('Navigate to notifications')}
          />
          
          <SettingItem
            icon="language-outline"
            title="Language"
            subtitle="Change app language"
            value="English"
            onPress={() => console.log('Navigate to language')}
          />
          
          <SettingItem
            icon="moon-outline"
            title="Dark Mode"
            subtitle="Enable dark theme"
            value="Off"
            onPress={() => console.log('Toggle dark mode')}
          />
        </Card>

        {/* Shop Settings (if manager) */}
        {user?.role === 'manager' && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Shop Settings</Text>
            
            <SettingItem
              icon="business-outline"
              title="Shop Profile"
              subtitle="Edit shop information"
              onPress={() => console.log('Navigate to shop profile')}
            />
            
            <SettingItem
              icon="people-outline"
              title="Manage Users"
              subtitle="Add or remove mechanics"
              onPress={() => console.log('Navigate to user management')}
            />
            
            <SettingItem
              icon="clipboard-outline"
              title="Inspection Templates"
              subtitle="Customize inspection items"
              onPress={() => console.log('Navigate to templates')}
            />
          </Card>
        )}

        {/* Account Actions */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => console.log('Navigate to change password')}
          />
          
          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help or contact support"
            onPress={() => console.log('Navigate to help')}
          />
          
          <SettingItem
            icon="information-circle-outline"
            title="About"
            subtitle="App version and info"
            onPress={() => console.log('Navigate to about')}
          />
        </Card>

        {/* Sign Out */}
        <Card style={styles.card}>
          <Button
            title="Sign Out"
            variant="danger"
            fullWidth
            leftIcon="log-out-outline"
            onPress={handleLogout}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  value,
  onPress,
}) => {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={24} color={COLORS.text.secondary} />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        <Ionicons name="chevron-forward" size={20} color={COLORS.text.tertiary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  profileRole: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  settingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  settingSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginRight: SPACING.sm,
  },
});

export default SettingsScreen;