import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import useCommunityStore from '../../store/communityStore';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import ShareOutfitModal from './components/ShareOutfitModal';
import { palette } from '../../theme/colors';
import { radius, shadow, spacing, type } from '../../theme/tokens';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { key: 'feed', label: 'Feed' },
  { key: 'top-rated', label: 'Top Rated', icon: '⭐' },
  { key: 'favorites', label: 'Favorites', icon: '❤️' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
];

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export default function CommunityScreen({ navigation }) {
  const feedItems = useCommunityStore((s) => s.feedItems);
  const topRatedItems = useCommunityStore((s) => s.topRatedItems);
  const favoriteItems = useCommunityStore((s) => s.favoriteItems);
  const notifications = useCommunityStore((s) => s.notifications);
  const unreadCount = useCommunityStore((s) => s.unreadCount);

  const loading = useCommunityStore((s) => s.loading);
  const refreshing = useCommunityStore((s) => s.refreshing);
  const loadingMore = useCommunityStore((s) => s.loadingMore);
  const topRatedLoading = useCommunityStore((s) => s.topRatedLoading);
  const topRatedLoadingMore = useCommunityStore((s) => s.topRatedLoadingMore);
  const favoritesLoading = useCommunityStore((s) => s.favoritesLoading);
  const favoritesLoadingMore = useCommunityStore((s) => s.favoritesLoadingMore);
  const notificationsLoading = useCommunityStore((s) => s.notificationsLoading);
  const notificationsLoadingMore = useCommunityStore((s) => s.notificationsLoadingMore);

  const hasMore = useCommunityStore((s) => s.hasMore);
  const topRatedHasMore = useCommunityStore((s) => s.topRatedHasMore);
  const favoritesHasMore = useCommunityStore((s) => s.favoritesHasMore);
  const notificationsHasMore = useCommunityStore((s) => s.notificationsHasMore);
  const feedPagination = useCommunityStore((s) => s.feedPagination);

  const fetchFeed = useCommunityStore((s) => s.fetchFeed);
  const refreshFeed = useCommunityStore((s) => s.refreshFeed);
  const fetchTopRated = useCommunityStore((s) => s.fetchTopRated);
  const fetchFavorites = useCommunityStore((s) => s.fetchFavorites);
  const fetchNotifications = useCommunityStore((s) => s.fetchNotifications);
  const markAllRead = useCommunityStore((s) => s.markAllRead);
  const addReaction = useCommunityStore((s) => s.addReaction);
  const toggleFavorite = useCommunityStore((s) => s.toggleFavorite);
  const rateOutfit = useCommunityStore((s) => s.rateOutfit);
  const shareOutfit = useCommunityStore((s) => s.shareOutfit);
  const unshareOutfit = useCommunityStore((s) => s.unshareOutfit);
  const incrementCommentCount = useCommunityStore((s) => s.incrementCommentCount);
  const decrementCommentCount = useCommunityStore((s) => s.decrementCommentCount);

  const [activeTab, setActiveTab] = useState('feed');
  const [commentsItem, setCommentsItem] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchFeed(true);
    fetchNotifications(true);
  }, [fetchFeed, fetchNotifications]);

  useEffect(() => {
    if (activeTab === 'top-rated' && topRatedItems.length === 0 && !topRatedLoading) fetchTopRated(true);
    if (activeTab === 'favorites' && favoriteItems.length === 0 && !favoritesLoading) fetchFavorites(true);
    if (activeTab === 'notifications' && notifications.length === 0 && !notificationsLoading) fetchNotifications(true);
  }, [
    activeTab,
    topRatedItems.length,
    topRatedLoading,
    favoriteItems.length,
    favoritesLoading,
    notifications.length,
    notificationsLoading,
    fetchTopRated,
    fetchFavorites,
    fetchNotifications,
  ]);

  const handleReact = useCallback((shareId, emojiType) => {
    addReaction(shareId, emojiType);
  }, [addReaction]);

  const handleRate = useCallback((shareId, score) => {
    rateOutfit(shareId, score);
  }, [rateOutfit]);

  const handleToggleFavorite = useCallback((shareId) => {
    toggleFavorite(shareId);
  }, [toggleFavorite]);

  const handleOpenComments = useCallback((item) => {
    setCommentsItem(item);
  }, []);

  const handleNavigateToProfile = useCallback((userId) => {
    if (!userId) return;
    setCommentsItem(null);
    setTimeout(() => {
      navigation.navigate('Profile', { userId: String(userId) });
    }, 150);
  }, [navigation]);

  const handleShare = useCallback(async (outfitId, description) => {
    return shareOutfit(outfitId, description);
  }, [shareOutfit]);

  const handleDeleteShare = useCallback((item, sharedOutfitId) => {
    const shareId = String(sharedOutfitId || item?.id || item?._id || '');
    if (!shareId) return;
    setDeleteTarget({
      id: shareId,
      name: item?.outfit?.name || item?.outfit_name || item?.name || 'this outfit',
    });
    setDeleteModalOpen(true);
  }, [unshareOutfit]);

  const confirmDeleteShare = useCallback(async () => {
    const shareId = String(deleteTarget?.id || '');
    if (!shareId || deleteLoading) return;
    setDeleteLoading(true);
    const result = await unshareOutfit(shareId);
    setDeleteLoading(false);
    if (result?.success === false) {
      Alert.alert('Delete failed', result?.error || 'Could not delete shared outfit.');
      return;
    }
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  }, [deleteLoading, deleteTarget?.id, unshareOutfit]);

  const renderFeedItem = useCallback(({ item }) => (
    <FeedCard
      item={item}
      onReact={handleReact}
      onRate={handleRate}
      onToggleFavorite={handleToggleFavorite}
      onOpenComments={handleOpenComments}
      onNavigateToProfile={handleNavigateToProfile}
      onDeleteShare={handleDeleteShare}
    />
  ), [handleReact, handleRate, handleToggleFavorite, handleOpenComments, handleNavigateToProfile, handleDeleteShare]);

  const keyExtractor = useCallback((item) => String(item?.id || item?._id || Math.random()), []);

  const subtitleCount = feedPagination?.total || feedItems.length;

  const findPostBySharedId = useCallback((sharedOutfitId) => {
    const allPosts = [...feedItems, ...topRatedItems, ...favoriteItems];
    return allPosts.find((item) => (item?.id || item?._id) === sharedOutfitId) || null;
  }, [feedItems, topRatedItems, favoriteItems]);

  const handleNotificationPress = useCallback(async (notification) => {
    const sharedOutfitId = notification?.shared_outfit_id;
    if (!sharedOutfitId) return;
    const target = findPostBySharedId(sharedOutfitId);
    if (target) {
      setActiveTab('feed');
      setCommentsItem(target);
      return;
    }
    await fetchFeed(true);
    const refreshed = findPostBySharedId(sharedOutfitId);
    if (refreshed) {
      setActiveTab('feed');
      setCommentsItem(refreshed);
    }
  }, [findPostBySharedId, fetchFeed]);

  const renderNotification = useCallback(({ item }) => {
    const actorName = item?.actor?.name || 'Someone';
    const detail = item?.detail ? ` • ${item.detail}` : '';
    const isRead = !!item?.is_read;
    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={[styles.notificationCard, !isRead ? styles.notificationUnread : null]}
      >
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationActor}>{actorName}</Text>
          <Text style={styles.notificationTime}>{formatTimeAgo(item?.created_at || item?.createdAt)}</Text>
        </View>
        <Text style={styles.notificationText}>
          {item?.type || 'activity'}{detail}
        </Text>
        {item?.outfit_name ? <Text style={styles.notificationOutfit}>{item.outfit_name}</Text> : null}
      </Pressable>
    );
  }, [handleNotificationPress]);

  const renderEmpty = useCallback((title, description) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👗</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  ), []);

  const renderLoading = useCallback((text) => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.loadingText}>{text}</Text>
      <View style={styles.skeletonList}>
        <SkeletonBlock height={220} borderRadius={radius.lg} />
        <SkeletonBlock height={220} borderRadius={radius.lg} />
      </View>
    </View>
  ), []);

  const renderFeedList = useCallback(({
    items,
    isLoading,
    isRefreshing,
    onRefresh,
    onEndReached,
    hasMoreItems,
    loadingMoreItems,
    loadingLabel,
    emptyTitle,
    emptyDescription,
  }) => {
    if (isLoading && items.length === 0) return renderLoading(loadingLabel || 'Loading community feed...');
    if (items.length === 0) return renderEmpty(emptyTitle, emptyDescription);
    return (
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderFeedItem}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={!!isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        ) : undefined}
        onEndReached={() => {
          if (hasMoreItems && !loadingMoreItems) onEndReached?.();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMoreItems ? <ActivityIndicator color={palette.primary} style={styles.loadMoreSpinner} /> : null}
      />
    );
  }, [keyExtractor, renderFeedItem, renderLoading, renderEmpty]);

  const notificationSection = useMemo(() => {
    if (notificationsLoading && notifications.length === 0) return renderLoading('Loading notifications...');
    return (
      <>
        <View style={styles.notificationActions}>
          <Text style={styles.notificationSummary}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
          <Pressable onPress={markAllRead} style={styles.markReadButton}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </Pressable>
        </View>
        {notifications.length === 0 ? (
          renderEmpty('No notifications yet', 'You will see reactions, ratings, and comments here.')
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={keyExtractor}
            renderItem={renderNotification}
            contentContainerStyle={styles.notificationList}
            onEndReached={() => {
              if (notificationsHasMore && !notificationsLoadingMore) fetchNotifications(false);
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={notificationsLoadingMore ? <ActivityIndicator color={palette.primary} style={styles.loadMoreSpinner} /> : null}
          />
        )}
      </>
    );
  }, [
    notificationsLoading,
    notifications,
    renderLoading,
    unreadCount,
    markAllRead,
    renderEmpty,
    keyExtractor,
    renderNotification,
    notificationsHasMore,
    notificationsLoadingMore,
    fetchNotifications,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>
            {subtitleCount} outfit{subtitleCount !== 1 ? 's' : ''} shared
          </Text>
        </View>
        <Pressable onPress={() => setShareOpen(true)} style={styles.shareButton}>
          <Text style={styles.shareButtonText}>+ Share Outfit</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
              >
                {tab.icon ? <Text style={styles.tabIcon}>{tab.icon}</Text> : null}
                <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{tab.label}</Text>
                {tab.key === 'notifications' && unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {activeTab === 'feed' && renderFeedList({
        items: feedItems,
        isLoading: loading,
        isRefreshing: refreshing,
        onRefresh: refreshFeed,
        onEndReached: () => fetchFeed(false),
        hasMoreItems: hasMore,
        loadingMoreItems: loadingMore,
        loadingLabel: 'Loading feed...',
        emptyTitle: 'Nothing shared yet',
        emptyDescription: 'Be the first to share an outfit with the community!',
      })}

      {activeTab === 'top-rated' && renderFeedList({
        items: topRatedItems,
        isLoading: topRatedLoading,
        onRefresh: () => fetchTopRated(true),
        onEndReached: () => fetchTopRated(false),
        hasMoreItems: topRatedHasMore,
        loadingMoreItems: topRatedLoadingMore,
        loadingLabel: 'Loading top rated...',
        emptyTitle: 'No top-rated outfits yet',
        emptyDescription: 'Rate some outfits to see the highest-ranked looks here.',
      })}

      {activeTab === 'favorites' && renderFeedList({
        items: favoriteItems,
        isLoading: favoritesLoading,
        onRefresh: () => fetchFavorites(true),
        onEndReached: () => fetchFavorites(false),
        hasMoreItems: favoritesHasMore,
        loadingMoreItems: favoritesLoadingMore,
        loadingLabel: 'Loading favorites...',
        emptyTitle: 'No favorites yet',
        emptyDescription: 'Favorite outfits from the feed to build your collection.',
      })}

      {activeTab === 'notifications' && notificationSection}

      <CommentsModal
        visible={!!commentsItem}
        onClose={() => setCommentsItem(null)}
        shareItem={commentsItem}
        onCommentAdded={incrementCommentCount}
        onCommentDeleted={decrementCommentCount}
        onNavigateToProfile={handleNavigateToProfile}
      />

      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (deleteLoading) return;
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={44} color="#be185d" />
            </View>
            <Text style={styles.deleteTitle}>Delete</Text>
            <Text style={styles.deleteMessage}>
              Are you sure that you want to delete "{deleteTarget?.name || 'this outfit'}"?
            </Text>
            <View style={styles.deleteActions}>
              <Pressable
                disabled={deleteLoading}
                onPress={() => {
                  setDeleteModalOpen(false);
                  setDeleteTarget(null);
                }}
                style={styles.deleteCancelBtn}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={deleteLoading}
                onPress={confirmDeleteShare}
                style={[styles.deleteConfirmBtn, deleteLoading ? { opacity: 0.8 } : null]}
              >
                <Text style={styles.deleteConfirmText}>{deleteLoading ? 'Deleting...' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ShareOutfitModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onShare={handleShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...type.h1,
    color: palette.text,
  },
  subtitle: {
    ...type.body,
    color: palette.textMuted,
    marginTop: 2,
  },
  shareButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    ...shadow.soft,
  },
  shareButtonText: {
    ...type.label,
    color: palette.textOnDark,
  },
  tabBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSoft,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 2,
  },
  tabButton: {
    flexShrink: 0,
    minHeight: 36,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    position: 'relative',
  },
  tabButtonActive: {
    backgroundColor: palette.surfaceElevated,
    ...shadow.soft,
  },
  tabIcon: {
    fontSize: 12,
  },
  tabText: {
    ...type.caption,
    color: palette.textMuted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: palette.primaryStrong,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    ...type.body,
    color: palette.textMuted,
  },
  skeletonList: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...type.title,
    color: palette.text,
    textAlign: 'center',
  },
  emptyDescription: {
    ...type.body,
    color: palette.textMuted,
    textAlign: 'center',
  },
  feedContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  loadMoreSpinner: {
    marginVertical: spacing.md,
  },
  notificationActions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationSummary: {
    ...type.label,
    color: palette.textMuted,
  },
  markReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  markReadText: {
    ...type.caption,
    color: palette.primaryStrong,
    fontWeight: '700',
  },
  notificationList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs + 2,
  },
  notificationCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceElevated,
    padding: spacing.sm,
    ...shadow.soft,
  },
  notificationUnread: {
    borderColor: palette.primaryLighter,
    backgroundColor: palette.primarySoft,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationActor: {
    ...type.label,
    color: palette.text,
    fontWeight: '700',
  },
  notificationTime: {
    ...type.caption,
    color: palette.textMuted,
  },
  notificationText: {
    ...type.body,
    color: palette.text,
  },
  notificationOutfit: {
    marginTop: 4,
    ...type.caption,
    color: palette.primaryStrong,
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  deleteCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    ...shadow.soft,
  },
  deleteIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fce7f3',
    marginBottom: 12,
  },
  deleteTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: palette.primary,
    marginBottom: 8,
  },
  deleteMessage: {
    textAlign: 'center',
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 14,
  },
  deleteActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#9333ea',
    backgroundColor: palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  deleteConfirmBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#be185d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
