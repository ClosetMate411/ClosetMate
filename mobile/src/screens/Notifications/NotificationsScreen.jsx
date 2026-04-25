import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useCommunityStore from '../../store/communityStore';
import { palette } from '../../theme/colors';

const formatAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const typeConfig = {
  rating:   { icon: 'star',              color: '#f59e0b', verb: 'rated your outfit' },
  reaction: { icon: 'happy-outline',     color: palette.primary, verb: 'reacted to your outfit' },
  comment:  { icon: 'chatbubble',        color: palette.primary, verb: 'commented on your outfit' },
  reply:    { icon: 'at',                color: palette.primary, verb: 'mentioned you' },
  favorite: { icon: 'heart',             color: palette.danger, verb: 'favorited your outfit' },
};

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const items = useCommunityStore((s) => s.notifications);
  const unreadCount = useCommunityStore((s) => s.unreadCount);
  const loading = useCommunityStore((s) => s.notificationsLoading);
  const hasMore = useCommunityStore((s) => s.notificationsHasMore);
  const fetchNotifications = useCommunityStore((s) => s.fetchNotifications);
  const markNotificationsRead = useCommunityStore((s) => s.markNotificationsRead);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchNotifications(true); }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  const renderItem = useCallback(({ item }) => {
    const cfg = typeConfig[item.type] || { icon: 'notifications', color: palette.primary, verb: item.type };
    const actorName = item?.actor?.name || 'Someone';
    const actorAvatar = item?.actor?.avatar_url;
    const outfitName = item?.outfit_name || 'an outfit';
    return (
      <Pressable
        onPress={() => item?.shared_outfit_id && navigation.navigate('Community')}
        style={{
          flexDirection: 'row', alignItems: 'center',
          padding: 14, backgroundColor: item.is_read ? palette.surface : palette.surfaceSoft,
          borderRadius: 12, borderWidth: 1, borderColor: palette.border,
          gap: 12,
        }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: palette.primary,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {actorAvatar ? (
            <Image source={{ uri: actorAvatar }} style={{ width: 40, height: 40 }} />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800' }}>{actorName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: palette.text }}>
            <Text style={{ fontWeight: '700' }}>{actorName}</Text>{' '}
            <Text style={{ color: palette.textMuted }}>{cfg.verb}</Text>{' '}
            <Text style={{ fontWeight: '600' }}>{outfitName}</Text>
            {item.detail ? <Text style={{ color: palette.textMuted }}> — {item.detail}</Text> : null}
          </Text>
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 2 }}>
            {formatAgo(item.created_at)}
          </Text>
        </View>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </Pressable>
    );
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{
        padding: 20, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text }}>🔔 Notifications</Text>
          {unreadCount > 0 ? (
            <Text style={{ color: palette.primary, marginTop: 2, fontWeight: '600' }}>
              {unreadCount} unread
            </Text>
          ) : null}
        </View>
        {items.length > 0 && unreadCount > 0 && (
          <Pressable
            onPress={markNotificationsRead}
            style={{
              paddingVertical: 8, paddingHorizontal: 12,
              borderRadius: 10, borderWidth: 1, borderColor: palette.border,
            }}
          >
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 42, marginBottom: 10 }}>📭</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>
            No notifications yet
          </Text>
          <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 6 }}>
            Share outfits to get reactions, ratings, and comments!
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i?.id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
          onEndReached={() => hasMore && fetchNotifications(false)}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}
