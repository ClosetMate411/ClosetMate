import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import useAuthStore from '../../store/authStore';
import useCommunityStore from '../../store/communityStore';
import apiService from '../../services/api.service';
import FeedCard from '../Community/components/FeedCard';
import CommentsModal from '../Community/components/CommentsModal';
import { palette } from '../../theme/colors';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const routeUserId = route.params?.userId;
  const currentUser = useAuthStore((s) => s.user);
  const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl); // may not exist — defensive

  const selfUserId = currentUser?.user_id || currentUser?.id;
  const profileUserId = routeUserId || selfUserId;
  const isSelf = !routeUserId || routeUserId === selfUserId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commentsItem, setCommentsItem] = useState(null);

  const addReaction = useCommunityStore((s) => s.addReaction);
  const rateOutfit = useCommunityStore((s) => s.rateOutfit);
  const toggleFavoriteShared = useCommunityStore((s) => s.toggleFavoriteShared);
  const unshareOutfit = useCommunityStore((s) => s.unshareOutfit);

  const load = useCallback(async () => {
    if (!profileUserId) { setLoading(false); return; }
    try {
      const res = await apiService.getUserProfile(profileUserId);
      if (res?.success) setProfile(res.data);
    } catch (_e) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [profileUserId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Media library access is required to change avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const fileObject = {
      uri: asset.uri,
      name: asset.fileName || `avatar-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };

    setUploading(true);
    try {
      const res = await apiService.updateAvatar(fileObject);
      const url = res?.data?.avatar_url;
      if (url) {
        setProfile((p) => p ? { ...p, user: { ...p.user, avatar_url: url } } : p);
        if (typeof setAvatarUrl === 'function') setAvatarUrl(url);
      }
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Try again.');
    } finally {
      setUploading(false);
    }
  }, [setAvatarUrl]);

  const deleteAvatar = useCallback(async () => {
    Alert.alert('Remove avatar?', 'Your profile picture will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteAvatar();
            setProfile((p) => p ? { ...p, user: { ...p.user, avatar_url: null } } : p);
            if (typeof setAvatarUrl === 'function') setAvatarUrl(null);
          } catch (e) {
            Alert.alert('Remove failed', e.message || 'Try again.');
          }
        },
      },
    ]);
  }, [setAvatarUrl]);

  const handleUnshare = useCallback((item) => {
    const shareId = item?.id || item?._id;
    Alert.alert('Remove from community?', 'This will delete the shared post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await unshareOutfit(shareId);
          setProfile((p) => p ? { ...p, outfits: p.outfits.filter((o) => (o.id || o._id) !== shareId) } : p);
        },
      },
    ]);
  }, [unshareOutfit]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: palette.textMuted }}>Profile not found</Text>
      </View>
    );
  }

  const { user, stats, outfits } = profile;
  const name = user?.name || user?.full_name || 'User';
  const avatarUrl = user?.avatar_url;

  const renderItem = ({ item }) => (
    <FeedCard
      item={item}
      onReact={(id, emoji) => addReaction(id, emoji)}
      onRate={(id, score) => rateOutfit(id, score)}
      onOpenComments={setCommentsItem}
      onToggleFavorite={toggleFavoriteShared}
      onUnshare={isSelf ? handleUnshare : undefined}
      onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={outfits || []}
        keyExtractor={(o) => String(o?.id || Math.random())}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={{ padding: 20 }}>
            {/* Avatar + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <View style={{ position: 'relative' }}>
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: palette.primary,
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80 }} />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 28 }}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                {isSelf && (
                  <Pressable
                    onPress={pickAvatar}
                    style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: palette.primary,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: palette.surface,
                    }}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={14} color="#fff" />
                    )}
                  </Pressable>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text }} numberOfLines={1}>
                    {name}
                  </Text>
                  {user?.is_self && (
                    <View style={{ backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.primary }}>You</Text>
                    </View>
                  )}
                </View>
                {isSelf && avatarUrl && (
                  <Pressable onPress={deleteAvatar} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: palette.danger, fontWeight: '600' }}>
                      Remove avatar
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Stats row */}
            <View style={{
              flexDirection: 'row', gap: 8,
              marginBottom: 20,
            }}>
              {[
                { label: 'SHARED', value: stats?.total_shared ?? 0 },
                { label: 'AVG RATING', value: stats?.average_rating != null ? Number(stats.average_rating).toFixed(1) : '-' },
                { label: 'RATINGS', value: stats?.total_ratings_received ?? 0 },
                { label: 'FAVORITES', value: stats?.total_favorites_received ?? 0 },
              ].map((s) => (
                <View key={s.label} style={{
                  flex: 1, borderWidth: 1, borderColor: palette.border,
                  backgroundColor: palette.surface,
                  borderRadius: 12, padding: 12, alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: palette.primary }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: palette.textMuted, marginTop: 2, fontWeight: '700', letterSpacing: 0.5 }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Shared Outfits</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ color: palette.textMuted }}>No shared outfits yet.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      />

      <CommentsModal visible={!!commentsItem} onClose={() => setCommentsItem(null)} shareItem={commentsItem} />
    </View>
  );
}
