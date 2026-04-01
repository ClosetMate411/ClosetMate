import React, { memo, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconTrash, IconMessageCircle } from '@tabler/icons-react';
import useCommunityStore from '../../../store/communityStore';
import './FeedCard.css';

const EMOJI_MAP = { like: '👍', love: '❤️', fire: '🔥', cool: '😎', wow: '😮' };
const EMOJI_TYPES = ['like', 'love', 'fire', 'cool', 'wow'];

const formatRelativeTime = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const FeedCard = ({ item, wardrobeItems, onCommentClick, onUnshare }) => {
  const { outfit, shared_by, description, shared_at, ratings, reactions, comment_count, favorites } = item;
  const rateOutfit = useCommunityStore((s) => s.rateOutfit);
  const reactToOutfit = useCommunityStore((s) => s.reactToOutfit);
  const toggleFavorite = useCommunityStore((s) => s.toggleFavorite);

  const [isRating, setIsRating] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [hoverRating, setHoverRating] = useState(null);

  const handleFavorite = useCallback(async () => {
    if (isFavoriting) return;
    setIsFavoriting(true);
    try {
      await toggleFavorite(item.id);
    } finally {
      setIsFavoriting(false);
    }
  }, [item.id, toggleFavorite, isFavoriting]);

  // Use backend-resolved items (with image_url), fallback to local wardrobe match
  const resolvedItems = useMemo(() => {
    if (outfit.items && outfit.items.length > 0) {
      return outfit.items.slice(0, 4).map((i) => ({
        id: i.id,
        name: i.name || 'Unknown',
        image: i.image_url,
      }));
    }
    // Fallback for old data without resolved items
    return outfit.item_ids.slice(0, 4).map((id) => wardrobeItems.find((w) => w.id === id) || null);
  }, [outfit.items, outfit.item_ids, wardrobeItems]);

  const handleReact = useCallback(
    async (emojiType) => {
      if (isReacting) return;
      setIsReacting(true);
      try {
        await reactToOutfit(item.id, emojiType);
      } finally {
        setIsReacting(false);
      }
    },
    [item.id, reactToOutfit, isReacting]
  );

  const handleRate = useCallback(
    async (score) => {
      if (isRating) return;
      setIsRating(true);
      try {
        await rateOutfit(item.id, score);
      } finally {
        setIsRating(false);
      }
    },
    [item.id, rateOutfit, isRating]
  );

  const activeRating = hoverRating ?? ratings.user_rating ?? 0;

  return (
    <div className="feed-card">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="feed-card-header">
        <div className="feed-card-user">
          <div className="feed-card-avatar" aria-hidden="true">
            {shared_by.name.charAt(0).toUpperCase()}
          </div>
          <div className="feed-card-user-info">
            <span className="feed-card-username">
              {shared_by.name}
              {shared_by.is_self && <span className="feed-you-badge">You</span>}
            </span>
            <span className="feed-card-time">{formatRelativeTime(shared_at)}</span>
          </div>
        </div>

        {shared_by.is_self && (
          <button
            className="feed-unshare-btn"
            onClick={() => onUnshare(item)}
            title="Remove from community"
            aria-label="Remove from community"
          >
            <IconTrash size={15} />
          </button>
        )}
      </div>

      {/* ── Outfit Collage ──────────────────────────────── */}
      <div className="feed-collage">
        {[0, 1, 2, 3].map((i) => {
          const outfitItem = resolvedItems[i];
          // Only render a cell if there's a corresponding item_id slot
          if (i >= outfit.item_ids.length) {
            return <div key={i} className={`feed-collage-cell feed-collage-cell--empty feed-collage-cell--${i + 1}`} />;
          }
          return (
            <div key={i} className={`feed-collage-cell feed-collage-cell--${i + 1}`}>
              {outfitItem ? (
                <img src={outfitItem.image} alt={outfitItem.name} referrerPolicy="no-referrer" />
              ) : (
                <div className="feed-collage-placeholder" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
        {outfit.item_ids.length > 4 && (
          <div className="feed-collage-more">+{outfit.item_ids.length - 4}</div>
        )}
      </div>

      {/* ── Outfit Info ─────────────────────────────────── */}
      <div className="feed-card-info">
        <div className="feed-outfit-header">
          <h3 className="feed-outfit-name">{outfit.name}</h3>
          {outfit.cohesion_score != null && (
            <span className="feed-cohesion-score">{outfit.cohesion_score}/10</span>
          )}
        </div>
        <div className="feed-outfit-tags">
          {outfit.style && <span className="meta-tag">{outfit.style}</span>}
          {outfit.occasion && <span className="meta-tag">{outfit.occasion}</span>}
          {outfit.season && <span className="meta-tag">{outfit.season}</span>}
        </div>
        {description && <p className="feed-description">{description}</p>}
      </div>

      {/* ── Social Row ──────────────────────────────────── */}
      <div className="feed-social-row">
        {/* Emoji Reactions */}
        <div className="feed-reactions">
          {EMOJI_TYPES.map((emojiType) => {
            const isActive = reactions.user_reactions.includes(emojiType);
            const count = reactions.counts[emojiType] || 0;
            return (
              <button
                key={emojiType}
                className={`feed-reaction-btn${isActive ? ' active' : ''}`}
                onClick={() => handleReact(emojiType)}
                disabled={isReacting}
                title={emojiType}
                aria-pressed={isActive}
              >
                <span className="feed-reaction-emoji">{EMOJI_MAP[emojiType]}</span>
                {count > 0 && <span className="feed-reaction-count">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="feed-right-actions">
          {/* Star Rating */}
          <div
            className="feed-rating"
            onMouseLeave={() => setHoverRating(null)}
            aria-label={`Rate this outfit. Current rating: ${ratings.user_rating || 'none'}`}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`feed-star-btn${star <= activeRating ? ' active' : ''}`}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                disabled={isRating}
                aria-label={`${star} star`}
              >
                ★
              </button>
            ))}
            {ratings.average != null && (
              <span className="feed-rating-avg">
                {ratings.average}
                {ratings.count > 0 && <span className="feed-rating-count">({ratings.count})</span>}
              </span>
            )}
          </div>

          {/* Favorite */}
          <button
            className={`feed-favorite-btn${favorites?.user_has_favorited ? ' active' : ''}`}
            onClick={handleFavorite}
            disabled={isFavoriting}
            aria-label={favorites?.user_has_favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <span>{favorites?.user_has_favorited ? '❤️' : '🤍'}</span>
            {(favorites?.count || 0) > 0 && <span className="feed-favorite-count">{favorites.count}</span>}
          </button>

          {/* Comments */}
          <button
            className="feed-comments-btn"
            onClick={() => onCommentClick(item)}
            aria-label={`View ${comment_count} comments`}
          >
            <IconMessageCircle size={15} />
            <span>{comment_count}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

FeedCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    outfit: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      style: PropTypes.string,
      occasion: PropTypes.string,
      season: PropTypes.string,
      cohesion_score: PropTypes.number,
      item_ids: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    shared_by: PropTypes.shape({
      user_id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      is_self: PropTypes.bool.isRequired,
    }).isRequired,
    description: PropTypes.string,
    shared_at: PropTypes.string.isRequired,
    ratings: PropTypes.shape({
      average: PropTypes.number,
      count: PropTypes.number.isRequired,
      user_rating: PropTypes.number,
    }).isRequired,
    reactions: PropTypes.shape({
      counts: PropTypes.object.isRequired,
      user_reactions: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    comment_count: PropTypes.number.isRequired,
  }).isRequired,
  wardrobeItems: PropTypes.array.isRequired,
  onCommentClick: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
};

export default memo(FeedCard);
