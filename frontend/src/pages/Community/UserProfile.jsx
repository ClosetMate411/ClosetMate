import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container } from '@mantine/core';
import apiService from '../../services/api.service';
import useWardrobeStore from '../../store/wardrobeStore';
import useAuthStore from '../../store/authStore';
import { LoadingScreen, Toast } from '../../components';
import { useToast } from '../../hooks';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import useCommunityStore from '../../store/communityStore';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast, showError, showSuccess } = useToast();
  const { items: wardrobeItems, fetchItems } = useWardrobeStore();
  const { incrementCommentCount, decrementCommentCount, unshareOutfit } = useCommunityStore();
  const { updateAvatar, deleteAvatar } = useAuthStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const avatar_url = await updateAvatar(file);
      setProfile((prev) => ({ ...prev, user: { ...prev.user, avatar_url } }));
      showSuccess('Profile picture updated.');
    } catch (err) {
      showError(err.message || 'Failed to upload avatar.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [updateAvatar, showSuccess, showError]);

  const handleUnshare = useCallback(async (feedItem) => {
    if (!window.confirm('Remove this outfit from the community?')) return;
    try {
      await unshareOutfit(feedItem.id);
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          outfits: prev.outfits.filter((o) => o.id !== feedItem.id),
          stats: {
            ...prev.stats,
            total_shared: Math.max(0, (prev.stats?.total_shared || 0) - 1),
          },
        };
      });
      showSuccess('Outfit removed from community.');
    } catch (err) {
      showError(err.message || 'Failed to unshare outfit.');
    }
  }, [unshareOutfit, showSuccess, showError]);

  const handleAvatarDelete = useCallback(async () => {
    setUploading(true);
    try {
      await deleteAvatar();
      setProfile((prev) => ({ ...prev, user: { ...prev.user, avatar_url: null } }));
      showSuccess('Profile picture removed.');
    } catch (err) {
      showError(err.message || 'Failed to remove avatar.');
    } finally {
      setUploading(false);
    }
  }, [deleteAvatar, showSuccess, showError]);

  useEffect(() => {
    fetchItems();
    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await apiService.getUserProfile(userId);
        setProfile(response.data);
      } catch (err) {
        showError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <LoadingScreen />;
  if (!profile) return null;

  const { user, stats, outfits } = profile;

  return (
    <div className="profile-page-wrapper">
      <Container size="xl" py="xl">
        {/* Back button */}
        <button className="profile-back-btn" onClick={() => navigate(-1)}>
          &larr; Back
        </button>

        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-large">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.name} className="profile-avatar-img" referrerPolicy="no-referrer" />
                : user.name.charAt(0).toUpperCase()
              }
            </div>

            {user.is_self && !uploading && (
              <button
                className="profile-avatar-edit-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Change profile picture"
                aria-label="Change profile picture"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Edit
              </button>
            )}

            {uploading && (
              <div className="profile-avatar-uploading">
                <div className="profile-avatar-spinner" />
              </div>
            )}

            {user.is_self && user.avatar_url && !uploading && (
              <button
                className="profile-avatar-delete-btn"
                onClick={handleAvatarDelete}
                title="Remove profile picture"
                aria-label="Remove profile picture"
              >
                &times;
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="profile-info">
            <h1 className="profile-name">{user.name}</h1>
            {user.is_self && <span className="profile-you-badge">You</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="stat-value">{stats.total_shared}</span>
            <span className="stat-label">Shared</span>
          </div>
          <div className="profile-stat">
            <span className="stat-value">{stats.average_rating ?? '-'}</span>
            <span className="stat-label">Avg Rating</span>
          </div>
          <div className="profile-stat">
            <span className="stat-value">{stats.total_ratings_received}</span>
            <span className="stat-label">Ratings</span>
          </div>
          <div className="profile-stat">
            <span className="stat-value">{stats.total_favorites_received}</span>
            <span className="stat-label">Favorites</span>
          </div>
        </div>

        {/* Outfits */}
        <h2 className="profile-section-title">Shared Outfits</h2>
        {outfits.length === 0 ? (
          <div className="profile-empty">
            <p>No shared outfits yet.</p>
          </div>
        ) : (
          <div className="community-feed-grid">
            {outfits.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                wardrobeItems={wardrobeItems}
                onCommentClick={(feedItem) => {
                  setSelectedFeedItem(feedItem);
                  setCommentsOpen(true);
                }}
                onUnshare={handleUnshare}
              />
            ))}
          </div>
        )}
      </Container>

      <CommentsModal
        opened={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          setTimeout(() => setSelectedFeedItem(null), 300);
        }}
        feedItem={selectedFeedItem}
        onCommentAdded={(id) => incrementCommentCount(id)}
        onCommentDeleted={(id) => decrementCommentCount(id)}
      />

      <Toast {...toast} />
    </div>
  );
};

export default UserProfile;
