import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  RefreshControl, Pressable, StyleSheet, Image, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useCommunityStore from '../../store/communityStore';
import { palette } from '../../theme/colors';

/* ─── helpers ─────────────────────────────────────────────── */
const formatAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const VERBS = {
  comment:  'commented on',
  rating:   'rated',
  reaction: 'reacted to',
  reply:    'replied to your comment on',
  favorite: 'favorited',
};

const NOTIFICATIONS_REFRESH_MS = 15000;

/* ─── single notification row ─────────────────────────────── */
const NotificationRow = React.memo(function NotificationRow({ item, onPress }) {
  const actorName   = item?.actor?.name  || 'Someone';
  const actorAvatar = item?.actor?.avatar_url;
  const outfitName  = item?.outfit_name  || 'an outfit';
  const verb        = VERBS[item?.type]  || item?.type || 'interacted with';
  const isUnread    = !item?.is_read;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        isUnread && styles.rowUnread,
        pressed   && styles.rowPressed,
      ]}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        {actorAvatar ? (
          <Image source={{ uri: actorAvatar }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {actorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Text block */}
      <View style={styles.body}>
        <Text style={styles.message} numberOfLines={2}>
          <Text style={styles.actorName}>{actorName}</Text>
          {' '}
          <Text style={styles.verb}>{verb}</Text>
          {' '}
          <Text style={styles.outfitName}>{`"${outfitName}"`}</Text>
        </Text>
        <Text style={styles.time}>{formatAgo(item?.created_at)}</Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={palette.textSoft} />
    </Pressable>
  );
});

/* ─── main screen ─────────────────────────────────────────── */
export default function NotificationsScreen() {
  const navigation            = useNavigation();
  const items                 = useCommunityStore((s) => s.notifications);
  const unreadCount           = useCommunityStore((s) => s.unreadCount);
  const loading               = useCommunityStore((s) => s.notificationsLoading);
  const hasMore               = useCommunityStore((s) => s.notificationsHasMore);
  const fetchNotifications    = useCommunityStore((s) => s.fetchNotifications);
  const markAllRead           = useCommunityStore((s) => s.markAllRead);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchNotifications(true); }, [fetchNotifications]);

  useEffect(() => {
    let currentAppState = AppState.currentState;

    const refreshNotifications = () => {
      if (currentAppState === 'active') {
        fetchNotifications(true, { silent: true });
      }
    };

    const intervalId = setInterval(refreshNotifications, NOTIFICATIONS_REFRESH_MS);
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInactive = currentAppState !== 'active';
      currentAppState = nextAppState;
      if (wasInactive && nextAppState === 'active') refreshNotifications();
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  const handlePress = useCallback((item) => {
    if (item?.shared_outfit_id) {
      navigation.navigate('Community');
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <NotificationRow item={item} onPress={handlePress} />
  ), [handlePress]);

  const ListEmpty = loading ? null : (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        Share outfits to get reactions, ratings, and comments!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && items.length > 0 && (
          <Pressable onPress={markAllRead} style={styles.markBtn}>
            <Text style={styles.markBtnText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {loading && items.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i?.id ?? Math.random())}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
            />
          }
          onEndReached={() => hasMore && fetchNotifications(false)}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
  },
  unreadLabel: {
    fontSize: 13,
    color: palette.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  markBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  markBtnText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 13,
  },

  /* list */
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
  },

  /* row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: palette.surface,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: '#faf6ff',
  },
  rowPressed: {
    opacity: 0.7,
  },

  /* avatar */
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  /* text */
  body: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
  },
  actorName: {
    fontWeight: '700',
    color: palette.text,
  },
  verb: {
    color: palette.textMuted,
    fontWeight: '400',
  },
  outfitName: {
    fontWeight: '600',
    color: palette.text,
  },
  time: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 3,
  },

  /* separator */
  separator: {
    height: 1,
    backgroundColor: palette.borderSubtle,
    marginLeft: 70,
  },

  /* loader */
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* empty */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  emptySubtitle: {
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
