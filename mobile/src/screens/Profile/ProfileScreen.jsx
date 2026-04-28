import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../../theme/colors';
import { radius, shadow, spacing, type } from '../../theme/tokens';
import useAuthStore from '../../store/authStore';
import useWardrobeStore from '../../store/wardrobeStore';
import useCommunityStore from '../../store/communityStore';
import FeedCard from '../Community/components/FeedCard';
import CommentsModal from '../Community/components/CommentsModal';
import apiService from '../../services/api.service';
import * as ImagePicker from 'expo-image-picker';
import SkeletonBlock from '../../components/ui/SkeletonBlock';

const pickValue = (...values) => values.find((value) => typeof value === 'string' && value.trim().length > 0) || '-';

const getInitials = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('') || 'U';

const toNumberOrDash = (value) => (value === null || value === undefined ? '-' : value);
const AVATAR_GRADIENT = ['#7c3aed', '#c026d3'];

const resolveUserEntity = (value) => (value?.user && typeof value.user === 'object' ? value.user : value || {});
const resolveUserId = (value) => {
  const user = resolveUserEntity(value);
  return user?.id || user?._id || user?.user_id || user?.uid || null;
};

const resolveAvatarUrl = (...values) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0) || null;

const normalizeProfilePayload = (raw, fallbackUser, isSelf) => {
  const payload = raw?.data || raw || {};
  const nestedUser = payload?.user || {};
  const nestedStats = payload?.stats || {};
  const fallbackEntity = resolveUserEntity(fallbackUser);

  return {
    user: {
      id: nestedUser?.id || nestedUser?._id || nestedUser?.user_id || resolveUserId(fallbackEntity),
      name: pickValue(
        nestedUser?.name,
        nestedUser?.full_name,
        nestedUser?.fullName,
        fallbackEntity?.full_name,
        fallbackEntity?.fullName,
        fallbackEntity?.name,
        fallbackEntity?.username,
        fallbackEntity?.email
      ),
      avatar_url: resolveAvatarUrl(
        nestedUser?.avatar_url,
        nestedUser?.avatarUrl,
        fallbackEntity?.avatar_url,
        fallbackEntity?.avatarUrl
      ),
      is_self: nestedUser?.is_self ?? isSelf,
    },
    stats: {
      total_shared: toNumberOrDash(nestedStats?.total_shared ?? payload?.total_shared ?? 0),
      average_rating: toNumberOrDash(nestedStats?.average_rating ?? payload?.average_rating),
      total_ratings_received: toNumberOrDash(nestedStats?.total_ratings_received ?? payload?.total_ratings_received ?? 0),
      total_favorites_received: toNumberOrDash(nestedStats?.total_favorites_received ?? payload?.total_favorites_received ?? 0),
    },
    outfits: Array.isArray(payload?.outfits) ? payload.outfits : [],
  };
};

export default function ProfileScreen({ navigation, route }) {
  const authUserRaw = useAuthStore((store) => store.user);
  const setAvatarUrl = useAuthStore((store) => store.setAvatarUrl);
  const authUser = useMemo(() => resolveUserEntity(authUserRaw), [authUserRaw]);
  const fetchWardrobeItems = useWardrobeStore((store) => store.fetchItems);
  const toggleFavoriteShared = useCommunityStore((store) => store.toggleFavorite);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);

  const routeUserId = route?.params?.userId;
  const myUserId = resolveUserId(authUser);
  const userId = routeUserId || myUserId;
  const isSelfProfile = !routeUserId || String(routeUserId) === String(myUserId);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      await fetchWardrobeItems().catch(() => []);
      let resolvedUserId = userId;

      // If route/store didn't provide a resolvable id, fetch me and derive id from that payload.
      if (!resolvedUserId) {
        const meResponse = await apiService.getCurrentUser();
        resolvedUserId = resolveUserId(meResponse?.data || meResponse);
      }

      if (!resolvedUserId) {
        throw new Error('Profile user id is missing from auth response.');
      }

      const response = await apiService.getUserProfile(resolvedUserId);
      const normalized = normalizeProfilePayload(response, authUser, isSelfProfile);
      setProfile(normalized);
      setProfilePhotoUri(normalized?.user?.avatar_url || null);
    } catch (e) {
      setError(e?.message || 'Failed to load profile');
      setProfile(null);
      setProfilePhotoUri(null);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchWardrobeItems, authUser, isSelfProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fullName = useMemo(() => profile?.user?.name || '-', [profile]);
  const initials = useMemo(() => getInitials(fullName), [fullName]);
  const outfits = useMemo(() => (Array.isArray(profile?.outfits) ? profile.outfits : []), [profile]);
  const stats = profile?.stats || {};

  const updateCommentCount = useCallback((shareId, delta) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const updated = prev.outfits.map((item) => {
        const id = item?.id || item?._id;
        if (String(id) !== String(shareId)) return item;
        const current = Number(item?.comment_count ?? item?.comments_count ?? 0);
        const nextCount = Math.max(0, current + delta);
        return { ...item, comment_count: nextCount, comments_count: nextCount };
      });
      return { ...prev, outfits: updated };
    });
  }, []);

  const pickProfilePhoto = useCallback(async () => {
    if (!isSelfProfile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required to set a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    const uri = asset?.uri;
    if (!uri) return;

    const fileName = asset?.fileName || `avatar_${Date.now()}.jpg`;
    const mimeType = asset?.mimeType || (fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

    try {
      const response = await apiService.updateAvatar({
        uri,
        name: fileName,
        type: mimeType,
      });
      const avatarUrl = response?.data?.avatar_url || null;
      setProfilePhotoUri(avatarUrl);
      setAvatarUrl(avatarUrl);
      setProfile((prev) => (
        prev
          ? { ...prev, user: { ...prev.user, avatar_url: avatarUrl } }
          : prev
      ));
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not update profile photo.');
    }
  }, [isSelfProfile, setAvatarUrl]);

  const removeProfilePhoto = useCallback(() => {
    Alert.alert('Remove Photo', 'Do you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteAvatar();
            setProfilePhotoUri(null);
            setAvatarUrl(null);
            setProfile((prev) => (
              prev
                ? { ...prev, user: { ...prev.user, avatar_url: null } }
                : prev
            ));
          } catch (e) {
            Alert.alert('Delete failed', e?.message || 'Could not remove profile photo.');
          }
        },
      },
    ]);
  }, [setAvatarUrl]);

  const handleAvatarPress = useCallback(() => {
    if (!isSelfProfile) return;
    if (profilePhotoUri) {
      Alert.alert('Profile Photo', 'Choose an action', [
        { text: 'Change Photo', onPress: () => pickProfilePhoto() },
        { text: 'Remove Photo', style: 'destructive', onPress: () => removeProfilePhoto() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    pickProfilePhoto();
  }, [isSelfProfile, profilePhotoUri, pickProfilePhoto, removeProfilePhoto]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
        <View style={styles.loadingSkeletons}>
          <SkeletonBlock height={96} borderRadius={radius.lg} />
          <SkeletonBlock height={180} borderRadius={radius.lg} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingRoot}>
        <Ionicons name="warning-outline" size={28} color={palette.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.profileHeader}>
          <Pressable style={styles.avatar} onPress={handleAvatarPress} disabled={!isSelfProfile}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={AVATAR_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            )}
            {isSelfProfile ? (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{fullName}</Text>
            {profile?.user?.is_self ? <Text style={styles.youBadge}>You</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Shared" value={stats.total_shared} />
          <StatCard label="Avg Rating" value={stats.average_rating} />
          <StatCard label="Ratings" value={stats.total_ratings_received} />
          <StatCard label="Favorites" value={stats.total_favorites_received} />
        </View>

        <Text style={styles.sectionTitle}>Shared Outfits</Text>
        {outfits.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No shared outfits yet.</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {outfits.map((item) => (
              <FeedCard
                key={item?.id || item?._id}
                item={item}
                onReact={async (shareId, emojiType) => {
                  await apiService.addReaction(shareId, emojiType);
                  await loadProfile();
                }}
                onRate={async (shareId, score) => {
                  await apiService.rateOutfit(shareId, score);
                  await loadProfile();
                }}
                onOpenComments={(feedItem) => {
                  setSelectedFeedItem(feedItem);
                  setCommentsOpen(true);
                }}
                onDeleteShare={(feedItem, sharedOutfitId) => {
                  const targetId = String(sharedOutfitId || feedItem?.id || feedItem?._id || '');
                  if (!targetId) return;
                  Alert.alert('Delete shared outfit', 'This will remove your outfit from community. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await apiService.unshareOutfit(targetId);
                          await loadProfile();
                        } catch (e) {
                          Alert.alert('Delete failed', e?.message || 'Could not delete shared outfit.');
                        }
                      },
                    },
                  ]);
                }}
                onToggleFavorite={async (shareId) => {
                  await toggleFavoriteShared(shareId);
                  navigation.navigate('Favorites');
                }}
                forceShowDelete={isSelfProfile}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CommentsModal
        visible={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          setTimeout(() => setSelectedFeedItem(null), 250);
        }}
        shareItem={selectedFeedItem}
        onCommentAdded={(id) => updateCommentCount(id, 1)}
        onCommentDeleted={(id) => updateCommentCount(id, -1)}
      />
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    padding: spacing.xl,
    gap: spacing.xs + 2,
  },
  loadingText: {
    ...type.label,
    color: palette.textMuted,
  },
  loadingSkeletons: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: palette.primary,
    ...shadow.soft,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  backText: {
    color: palette.textMuted,
    ...type.label,
    fontWeight: '700',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryStrong,
    borderWidth: 1,
    borderColor: '#fff',
  },
  name: {
    color: palette.text,
    ...type.h1,
    fontWeight: '900',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  youBadge: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: palette.borderStrong,
    color: palette.primaryStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: 75,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.soft,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: palette.primary,
  },
  statLabel: {
    width: '100%',
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sectionTitle: {
    ...type.h2,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  emptyBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    paddingVertical: 26,
    alignItems: 'center',
    ...shadow.soft,
  },
  emptyText: {
    color: palette.textMuted,
    ...type.body,
  },
  feedList: {
    gap: spacing.sm,
  },
});
