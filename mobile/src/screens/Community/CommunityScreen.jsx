import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, Alert, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import useCommunityStore from '../../store/communityStore';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import ShareOutfitModal from './components/ShareOutfitModal';
import { palette } from '../../theme/colors';

const TABS = [
  { key: 'feed',         label: 'Feed',          icon: 'grid-outline'        },
  { key: 'top',          label: 'Top Rated',     icon: 'trophy-outline'      },
  { key: 'favorites',    label: 'Favorites',     icon: 'heart-outline'       },
  { key: 'notifications',label: 'Notifications', icon: 'notifications-outline' },
];

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

const notifTypeConfig = {
  rating:   { icon: 'star',          color: '#f59e0b',         verb: 'rated your outfit' },
  reaction: { icon: 'happy-outline', color: palette.primary,   verb: 'reacted to your outfit' },
  comment:  { icon: 'chatbubble',    color: palette.primary,   verb: 'commented on your outfit' },
  reply:    { icon: 'at',            color: palette.primary,   verb: 'mentioned you' },
  favorite: { icon: 'heart',         color: palette.danger,    verb: 'favorited your outfit' },
};

export default function CommunityScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState('feed');

  // Feed slice
  const feedItems            = useCommunityStore((s) => s.feedItems);
  const loading              = useCommunityStore((s) => s.loading);
  const refreshing           = useCommunityStore((s) => s.refreshing);
  const fetchFeed            = useCommunityStore((s) => s.fetchFeed);
  const refreshFeed          = useCommunityStore((s) => s.refreshFeed);

  // Top rated slice
  const topRatedItems        = useCommunityStore((s) => s.topRatedItems);
  const topRatedLoading      = useCommunityStore((s) => s.topRatedLoading);
  const topRatedHasMore      = useCommunityStore((s) => s.topRatedHasMore);
  const fetchTopRated        = useCommunityStore((s) => s.fetchTopRated);

  // Favorites slice
  const favorites            = useCommunityStore((s) => s.favorites);
  const favoritesLoading     = useCommunityStore((s) => s.favoritesLoading);
  const favoritesHasMore     = useCommunityStore((s) => s.favoritesHasMore);
  const fetchFavorites       = useCommunityStore((s) => s.fetchFavorites);

  // Notifications slice
  const notifications        = useCommunityStore((s) => s.notifications);
  const unreadCount          = useCommunityStore((s) => s.unreadCount);
  const notifLoading         = useCommunityStore((s) => s.notificationsLoading);
  const notifHasMore         = useCommunityStore((s) => s.notificationsHasMore);
  const fetchNotifications   = useCommunityStore((s) => s.fetchNotifications);
  const markNotificationsRead = useCommunityStore((s) => s.markNotificationsRead);

  // Shared actions
  const addReaction          = useCommunityStore((s) => s.addReaction);
  const rateOutfit           = useCommunityStore((s) => s.rateOutfit);
  const shareOutfit          = useCommunityStore((s) => s.shareOutfit);
  const toggleFavoriteShared = useCommunityStore((s) => s.toggleFavoriteShared);
  const unshareOutfit        = useCommunityStore((s) => s.unshareOutfit);

  const [commentsItem, setCommentsItem] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(false);

  // Fetch on tab switch
  useEffect(() => {
    if (tab === 'feed' && feedItems.length === 0) fetchFeed(true);
    if (tab === 'top' && topRatedItems.length === 0) fetchTopRated(true);
    if (tab === 'favorites' && favorites.length === 0) fetchFavorites(true);
    if (tab === 'notifications' && notifications.length === 0) fetchNotifications(true);
  }, [tab, feedItems.length, topRatedItems.length, favorites.length, notifications.length, fetchFeed, fetchTopRated, fetchFavorites, fetchNotifications]);

  // Always load feed on mount
  useEffect(() => { fetchFeed(true); }, [fetchFeed]);

  const handleReact          = useCallback((id, emoji) => addReaction(id, emoji), [addReaction]);
  const handleRate           = useCallback((id, score) => rateOutfit(id, score), [rateOutfit]);
  const handleOpenComments   = useCallback((item) => setCommentsItem(item), []);
  const handleShare          = useCallback((id, desc) => shareOutfit(id, desc), [shareOutfit]);
  const handleToggleFavorite = useCallback((id) => toggleFavoriteShared(id), [toggleFavoriteShared]);
  const handleOpenProfile    = useCallback((userId) => navigation.navigate('Profile', { userId }), [navigation]);

  const handleUnshare = useCallback((item) => {
    const shareId = item?.id || item?._id;
    Alert.alert(
      'Remove from community?',
      'This will delete the shared post, its ratings, reactions, and comments.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => unshareOutfit(shareId) },
      ],
    );
  }, [unshareOutfit]);

  const renderFeedItem = useCallback(({ item }) => (
    <FeedCard
      item={item}
      onReact={handleReact}
      onRate={handleRate}
      onOpenComments={handleOpenComments}
      onToggleFavorite={handleToggleFavorite}
      onUnshare={handleUnshare}
      onOpenProfile={handleOpenProfile}
    />
  ), [handleReact, handleRate, handleOpenComments, handleToggleFavorite, handleUnshare, handleOpenProfile]);

  const renderNotif = useCallback(({ item }) => {
    const cfg = notifTypeConfig[item.type] || { icon: 'notifications', color: palette.primary, verb: item.type };
    const actorName = item?.actor?.name || 'Someone';
    const actorAvatar = item?.actor?.avatar_url;
    const outfitName = item?.outfit_name || 'an outfit';
    return (
      <Pressable
        onPress={() => item?.shared_outfit_id && setTab('feed')}
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
  }, []);

  const keyExtractor = useCallback((it) => String(it?.id || it?._id || Math.random()), []);

  // Pick the active data slice + loaders
  const active = useMemo(() => {
    if (tab === 'top') return {
      data: topRatedItems, loading: topRatedLoading, hasMore: topRatedHasMore,
      onEnd: () => fetchTopRated(false),
      onRefresh: async () => { setLocalRefresh(true); await fetchTopRated(true); setLocalRefresh(false); },
      renderItem: renderFeedItem,
      emptyIcon: '⭐',
      emptyTitle: 'No rated outfits yet',
      emptyDesc: 'Rate outfits in the feed to populate this list.',
    };
    if (tab === 'favorites') return {
      data: favorites, loading: favoritesLoading, hasMore: favoritesHasMore,
      onEnd: () => fetchFavorites(false),
      onRefresh: async () => { setLocalRefresh(true); await fetchFavorites(true); setLocalRefresh(false); },
      renderItem: renderFeedItem,
      emptyIcon: '🤍',
      emptyTitle: 'No favorites yet',
      emptyDesc: 'Tap the heart on any outfit in the feed to save it here.',
    };
    if (tab === 'notifications') return {
      data: notifications, loading: notifLoading, hasMore: notifHasMore,
      onEnd: () => fetchNotifications(false),
      onRefresh: async () => { setLocalRefresh(true); await fetchNotifications(true); setLocalRefresh(false); },
      renderItem: renderNotif,
      emptyIcon: '📭',
      emptyTitle: 'No notifications yet',
      emptyDesc: 'Share outfits to get reactions, ratings, and comments.',
    };
    return {
      data: feedItems, loading, hasMore: true,
      onEnd: () => fetchFeed(false),
      onRefresh: refreshFeed,
      renderItem: renderFeedItem,
      emptyIcon: '👗',
      emptyTitle: 'No shared outfits yet',
      emptyDesc: 'Be the first to share an outfit!',
    };
  }, [
    tab, feedItems, loading, refreshFeed, fetchFeed,
    topRatedItems, topRatedLoading, topRatedHasMore, fetchTopRated,
    favorites, favoritesLoading, favoritesHasMore, fetchFavorites,
    notifications, notifLoading, notifHasMore, fetchNotifications,
    renderFeedItem, renderNotif,
  ]);

  const showShareButton = tab === 'feed' || tab === 'top' || tab === 'favorites';
  const showMarkRead = tab === 'notifications' && unreadCount > 0 && notifications.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
      }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: palette.text }}>Community</Text>
          <Text style={{ color: palette.textMuted, marginTop: 2, fontSize: 12 }}>
            {tab === 'feed'          ? `${feedItems.length} outfit${feedItems.length !== 1 ? 's' : ''} shared` : null}
            {tab === 'top'           ? 'Highest-rated outfits' : null}
            {tab === 'favorites'     ? 'Outfits you favorited' : null}
            {tab === 'notifications' ? (unreadCount > 0 ? `${unreadCount} unread` : 'All caught up') : null}
          </Text>
        </View>

        {showShareButton && (
          <Pressable
            onPress={() => setShareOpen(true)}
            style={{
              paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 12, backgroundColor: palette.primary,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Share</Text>
          </Pressable>
        )}
        {showMarkRead && (
          <Pressable
            onPress={markNotificationsRead}
            style={{
              paddingVertical: 8, paddingHorizontal: 12,
              borderRadius: 10, borderWidth: 1, borderColor: palette.border,
            }}
          >
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 12 }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 9,
                borderRadius: 18,
                backgroundColor: isActive ? palette.primary : palette.surfaceSoft,
              }}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={isActive ? '#fff' : palette.primary}
              />
              <Text style={{
                color: isActive ? '#fff' : palette.text,
                fontWeight: '700', fontSize: 13,
              }}>{t.label}</Text>
              {t.key === 'notifications' && unreadCount > 0 && (
                <View style={{
                  backgroundColor: isActive ? '#fff' : palette.primary,
                  paddingHorizontal: 6, paddingVertical: 1,
                  borderRadius: 8, minWidth: 18, alignItems: 'center',
                }}>
                  <Text style={{
                    color: isActive ? palette.primary : '#fff',
                    fontWeight: '800', fontSize: 10,
                  }}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Body */}
      {active.loading && active.data.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : active.data.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 42, marginBottom: 10 }}>{active.emptyIcon}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center' }}>
            {active.emptyTitle}
          </Text>
          <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 6 }}>
            {active.emptyDesc}
          </Text>
        </View>
      ) : (
        <FlatList
          data={active.data}
          keyExtractor={keyExtractor}
          renderItem={active.renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={tab === 'feed' ? refreshing : localRefresh}
              onRefresh={active.onRefresh}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
          onEndReached={() => active.hasMore && active.onEnd()}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Modals */}
      <CommentsModal
        visible={!!commentsItem}
        onClose={() => setCommentsItem(null)}
        shareItem={commentsItem}
      />
      <ShareOutfitModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onShare={handleShare}
      />
    </View>
  );
}
