import React, { useEffect, useCallback, useState } from 'react';
import { Container } from '@mantine/core';
import useCommunityStore from '../../store/communityStore';
import useOutfitStore from '../../store/outfitStore';
import useWardrobeStore from '../../store/wardrobeStore';
import { LoadingScreen, Toast, ConfirmModal } from '../../components';
import { useToast, useModal } from '../../hooks';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import ShareOutfitModal from './components/ShareOutfitModal';
import './Community.css';

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
  } = useCommunityStore();

  const { outfits, fetchOutfits } = useOutfitStore();
  const { items: wardrobeItems, fetchItems } = useWardrobeStore();
  const { toast, showSuccess, showError } = useToast();
  const modal = useModal();

  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    fetchFeed(1);
    fetchOutfits();
    fetchItems();
  }, [fetchFeed, fetchOutfits, fetchItems]);

  // ── Comments ─────────────────────────────────────────
  const handleOpenComments = useCallback((item) => {
    setSelectedFeedItem(item);
    setCommentsOpen(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentsOpen(false);
    // Small delay so the modal closes gracefully before clearing item
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

        {/* ── Feed ─────────────────────────────────────── */}
        {loading && feed.length === 0 ? (
          <LoadingScreen />
        ) : feed.length === 0 ? (
          <div className="community-empty">
            <div className="community-empty-icon" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="community-empty-title">Nothing shared yet</h3>
            <p className="community-empty-text">Be the first to share an outfit with the community!</p>
            <button className="community-share-btn" onClick={() => setShareOpen(true)}>
              Share Your First Outfit
            </button>
          </div>
        ) : (
          <>
            <div className="community-feed-grid">
              {feed.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  wardrobeItems={wardrobeItems}
                  onCommentClick={handleOpenComments}
                  onUnshare={handleUnshareClick}
                />
              ))}
            </div>

            {hasMore && (
              <div className="community-load-more">
                <button
                  className="load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <span className="load-more-spinner" />
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </Container>

      {/* ── Modals ─────────────────────────────────────── */}
      <CommentsModal
        opened={commentsOpen}
        onClose={handleCloseComments}
        feedItem={selectedFeedItem}
        onCommentAdded={handleCommentAdded}
        onCommentDeleted={handleCommentDeleted}
      />

      <ShareOutfitModal
        opened={shareOpen}
        onClose={() => setShareOpen(false)}
        outfits={outfits}
        wardrobeItems={wardrobeItems}
        onShare={handleShare}
      />

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
