import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container } from '@mantine/core';
import apiService from '../../services/api.service';
import useWardrobeStore from '../../store/wardrobeStore';
import { LoadingScreen, Toast } from '../../components';
import { useToast } from '../../hooks';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import useCommunityStore from '../../store/communityStore';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast, showError } = useToast();
  const { items: wardrobeItems, fetchItems } = useWardrobeStore();
  const { incrementCommentCount, decrementCommentCount } = useCommunityStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

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
          <div className="profile-avatar-large">
            {user.name.charAt(0).toUpperCase()}
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
                onUnshare={() => {}}
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
