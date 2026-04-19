import React, { useEffect, useCallback, useState } from 'react';
import { Container } from '@mantine/core';
import { VirtuosoGrid } from 'react-virtuoso';
import useCommunityStore from '../../store/communityStore';
import useOutfitStore from '../../store/outfitStore';
import useWardrobeStore from '../../store/wardrobeStore';
import { LoadingScreen, Toast, ConfirmModal } from '../../components';
import { useToast, useModal } from '../../hooks';
import FeedCard from './components/FeedCard';
import NotificationList from './components/NotificationList';
import CommentsModal from './components/CommentsModal';
import ShareOutfitModal from './components/ShareOutfitModal';
import './Community.css';

const TABS = [
  { key: 'feed', label: 'Feed' },
  { key: 'top-rated', label: 'Top Rated', icon: '⭐' },
  { key: 'favorites', label: 'Favorites', icon: '❤️' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
];

const Community = () => {
  const {
    feed,
    pagination,
    loading,
    loadingMore,
    fetchFeed,
    shareOutfit,
    unshareOutfit,
    incrementCommentCount,
    decrementCommentCount,
    topRated,
    topRatedPagination,
    topRatedLoading,
    fetchTopRated,
    notifications,
    notificationsPagination,
    notificationsLoading,
    unreadCount,
    fetchNotifications,
    markAllRead,
    favorites,
    favoritesPagination,
    favoritesLoading,
    fetchFavorites,
  } = useCommunityStore();

  const { outfits, fetchOutfits } = useOutfitStore();
  const { items: wardrobeItems, fetchItems } = useWardrobeStore();
  const { toast, showSuccess, showError } = useToast();
  const modal = useModal();

  const [activeTab, setActiveTab] = useState('feed');
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    fetchFeed(1);
    fetchOutfits();
    fetchItems();
    fetchNotifications(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data when tab is first opened (only if not already loaded)
  useEffect(() => {
    if (activeTab === 'top-rated' && topRated.length === 0 && !topRatedLoading) {
      fetchTopRated(1);
    }
    if (activeTab === 'favorites' && favorites.length === 0 && !favoritesLoading) {
      fetchFavorites(1);
    }
    if (activeTab === 'notifications' && notifications.length === 0 && !notificationsLoading) {
      fetchNotifications(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Comments ─────────────────────────────────────────
  const handleOpenComments = useCallback((item) => {
    setSelectedFeedItem(item);
    setCommentsOpen(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentsOpen(false);
    setTimeout(() => setSelectedFeedItem(null), 300);
  }, []);

  const handleCommentAdded = useCallback(
    (sharedOutfitId) => incrementCommentCount(sharedOutfitId),
    [incrementCommentCount]
  );

  const handleCommentDeleted = useCallback(
    (sharedOutfitId) => decrementCommentCount(sharedOutfitId),
    [decrementCommentCount]
  );

  // ── Unshare ───────────────────────────────────────────
  const handleUnshareClick = useCallback(
    (item) => {
      modal.openConfirmModal('delete', { name: item.outfit.name }, async () => {
        try {
          await unshareOutfit(item.id);
          showSuccess('Outfit removed from the community.');
        } catch (err) {
          showError(err.message || 'Failed to unshare outfit.');
        }
      });
    },
    [modal, unshareOutfit, showSuccess, showError]
  );

  // ── Share ─────────────────────────────────────────────
  const handleShare = useCallback(
    async (outfitId, description) => {
      await shareOutfit(outfitId, description);
      showSuccess('Outfit shared to the community!');
    },
    [shareOutfit, showSuccess]
  );

  // ── Load More ─────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    try {
      await fetchFeed(pagination.page + 1);
    } catch {
      showError('Failed to load more outfits.');
    }
  }, [fetchFeed, pagination.page, showError]);

  const hasMore = pagination.page < pagination.pages;

  // ── Notification click → go to post ───────────────────
  const handleNotificationClick = useCallback((sharedOutfitId) => {
    const feedItem = feed.find((item) => item.id === sharedOutfitId);
    if (feedItem) {
      setActiveTab('feed');
      setSelectedFeedItem(feedItem);
      setCommentsOpen(true);
    }
  }, [feed]);

  // ── Mark notifications read ───────────────────────────
  const handleMarkRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  // ── Render feed content ───────────────────────────────
  const renderFeed = (items, isLoading, emptyMsg) => {
    if (isLoading && items.length === 0) return <LoadingScreen />;
    if (items.length === 0) {
      return (
        <div className="community-empty">
          <div className="community-empty-icon" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="community-empty-title">{emptyMsg}</h3>
        </div>
      );
    }
    return (
      <VirtuosoGrid
        useWindowScroll
        totalCount={items.length}
        listClassName="community-feed-grid"
        itemContent={(index) => (
          <FeedCard
            item={items[index]}
            wardrobeItems={wardrobeItems}
            onCommentClick={handleOpenComments}
            onUnshare={handleUnshareClick}
          />
        )}
      />
    );
  };

  return (
    <div className="community-page-wrapper">
      <Container size="xl" py="xl">
        {/* ── Page Header ──────────────────────────────── */}
        <div className="community-header">
          <div className="community-header-text">
            <h1 className="community-title">Community</h1>
            <p className="community-subtitle">
              {pagination.total > 0
                ? `${pagination.total} outfit${pagination.total !== 1 ? 's' : ''} shared`
                : 'Share your style with the world'}
            </p>
          </div>
          <button className="community-share-btn" onClick={() => setShareOpen(true)}>
            + Share Outfit
          </button>
        </div>

        {/* ── Tab Bar ──────────────────────────────────── */}
        <div className="community-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`community-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              {tab.label}
              {tab.key === 'notifications' && unreadCount > 0 && (
                <span className="tab-badge">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────── */}
        {activeTab === 'feed' && (
          <>
            {renderFeed(feed, loading, 'Nothing shared yet')}
            {hasMore && (
              <div className="community-load-more">
                <button
                  className="load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? <span className="load-more-spinner" /> : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'top-rated' && (
          renderFeed(topRated, topRatedLoading, 'No top-rated outfits yet. Rate some outfits to see them here!')
        )}

        {activeTab === 'favorites' && (
          renderFeed(favorites, favoritesLoading, 'No favorites yet. Tap the heart on outfits you love!')
        )}

        {activeTab === 'notifications' && (
          <NotificationList
            notifications={notifications}
            loading={notificationsLoading}
            onMarkRead={handleMarkRead}
            unreadCount={unreadCount}
            onNotificationClick={handleNotificationClick}
          />
        )}
      </Container>

      {/* ── Modals ─────────────────────────────────────── */}
      {commentsOpen && (
        <CommentsModal
          opened={commentsOpen}
          onClose={handleCloseComments}
          feedItem={selectedFeedItem}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />
      )}

      {shareOpen && (
        <ShareOutfitModal
          opened={shareOpen}
          onClose={() => setShareOpen(false)}
          outfits={outfits}
          wardrobeItems={wardrobeItems}
          onShare={handleShare}
        />
      )}

      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />

      <Toast {...toast} />
    </div>
  );
};

export default Community;
