import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import { palette } from '../theme/colors';
import { radius, shadow, spacing, type } from '../theme/tokens';

const DRAWER_LINKS = [
  {
    route: 'Wardrobe',
    title: 'Wardrobe',
    description: 'Manage your collection',
    iconFamily: 'mci',
    icon: 'wardrobe-outline',
  },
  {
    route: 'Community',
    title: 'Community',
    description: 'Share with others',
    iconFamily: 'mci',
    icon: 'account-group-outline',
  },
  {
    route: 'Outfits',
    title: 'Outfits',
    description: 'AI-generated combinations',
    iconFamily: 'ion',
    icon: 'sparkles-outline',
  },
];

const resolveDisplayName = (user) =>
  user?.full_name ||
  user?.fullName ||
  user?.name ||
  user?.username ||
  user?.email ||
  'Sude Ayaz';

const resolveAvatarUrl = (user) =>
  user?.avatar_url ||
  user?.avatarUrl ||
  user?.user?.avatar_url ||
  user?.user?.avatarUrl ||
  null;

const resolveProfileLabel = (user) => (user ? 'View Profile' : 'Guest Account');
const AVATAR_GRADIENT = ['#7c3aed', '#c026d3'];

const getInitials = (label) =>
  String(label)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S';

export default function CustomDrawerContent({ navigation, state }) {
  const insets = useSafeAreaInsets();
  const rawUser = useAuthStore((store) => store.user);
  const user = rawUser?.user && typeof rawUser.user === 'object' ? rawUser.user : rawUser;
  const activeRoute = state.routeNames[state.index];
  const displayName = useMemo(() => resolveDisplayName(user), [user]);
  const avatarUrl = useMemo(() => resolveAvatarUrl(user), [user]);
  const profileLabel = useMemo(() => resolveProfileLabel(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <DrawerContentScrollView
      bounces={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 20) },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Pressable onPress={() => navigation.closeDrawer()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={palette.textMuted} />
        </Pressable>
      </View>

      <Pressable
        style={styles.profileCard}
        onPress={() => {
          const userId = user?.id || user?._id || user?.user_id || user?.uid;
          navigation.navigate('Profile', userId ? { userId } : undefined);
          navigation.closeDrawer();
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={AVATAR_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileLink}>{profileLabel}</Text>
        </View>
      </Pressable>

      <View style={styles.linkList}>
        {DRAWER_LINKS.map((item) => {
          const isActive = item.route === activeRoute;

          return (
            <Pressable
              key={item.route}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [
                styles.linkCard,
                isActive && styles.linkCardActive,
                pressed && styles.linkCardPressed,
              ]}
            >
              <View style={styles.iconCell}>
                {item.iconFamily === 'ion' ? (
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={isActive ? palette.primaryStrong : palette.primary}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={26}
                    color={isActive ? palette.primaryStrong : palette.primary}
                  />
                )}
              </View>
              <View style={styles.linkText}>
                <Text style={styles.linkTitle}>{item.title}</Text>
                <Text style={styles.linkDescription}>{item.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.logoutButton} onPress={() => navigation.navigate('Logout')}>
          <Ionicons name="log-out-outline" size={18} color={palette.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
        <Text style={styles.footerText}>© 2026 ClosetMate</Text>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    ...type.h2,
    color: palette.primaryStrong,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceSoft,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: palette.primarySoft,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
    ...shadow.soft,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    ...type.title,
    color: palette.text,
  },
  profileLink: {
    ...type.label,
    color: palette.primary,
  },
  linkList: {
    gap: spacing.md,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  linkCardActive: {
    backgroundColor: '#faf6ff',
    borderColor: palette.border,
  },
  linkCardPressed: {
    transform: [{ translateX: -3 }],
  },
  iconCell: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...shadow.soft,
  },
  linkText: {
    flex: 1,
    gap: 3,
  },
  linkTitle: {
    ...type.title,
    color: palette.text,
  },
  linkDescription: {
    ...type.caption,
    color: palette.textMuted,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: palette.dangerSoft,
  },
  logoutText: {
    ...type.label,
    color: palette.danger,
  },
  footerText: {
    ...type.caption,
    color: palette.textMuted,
    letterSpacing: 0.3,
  },
});
