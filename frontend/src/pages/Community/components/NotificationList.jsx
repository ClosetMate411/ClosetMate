import React, { memo } from 'react';
import PropTypes from 'prop-types';
import './NotificationList.css';

const EMOJI_MAP = { like: '👍', love: '❤️', fire: '🔥', cool: '😎', wow: '😮' };

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

const getNotificationText = (n) => {
  const outfit = n.outfit_name ? `"${n.outfit_name}"` : 'your outfit';
  switch (n.type) {
    case 'rating':
      return { icon: '⭐', text: `rated ${outfit} ${n.detail}/5` };
    case 'reaction':
      return { icon: EMOJI_MAP[n.detail] || '👍', text: `reacted to ${outfit}` };
    case 'comment':
      return { icon: '💬', text: `commented on ${outfit}` };
    case 'favorite':
      return { icon: '❤️', text: `saved ${outfit} to favorites` };
    case 'reply':
      return { icon: '💬', text: `mentioned you on ${outfit}` };
    default:
      return { icon: '🔔', text: `interacted with ${outfit}` };
  }
};

const NotificationList = ({ notifications, loading, onMarkRead, unreadCount, onNotificationClick }) => {
  if (loading) {
    return (
      <div className="notif-loading">
        <span className="load-more-spinner" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="community-empty">
        <div className="community-empty-icon" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h3 className="community-empty-title">No notifications yet</h3>
        <p className="community-empty-text">When someone rates, reacts, or comments on your outfits, you'll see it here.</p>
      </div>
    );
  }

  return (
    <div className="notif-list">
      {unreadCount > 0 && (
        <div className="notif-mark-read-row">
          <span className="notif-unread-label">{unreadCount} unread</span>
          <button className="notif-mark-read-btn" onClick={onMarkRead}>Mark all read</button>
        </div>
      )}
      {notifications.map((n) => {
        const { icon, text } = getNotificationText(n);
        return (
          <div
            key={n.id}
            className={`notif-item${n.is_read ? '' : ' unread'} clickable`}
            onClick={() => onNotificationClick?.(n.shared_outfit_id)}
            role="button"
            tabIndex={0}
          >
            <span className="notif-icon">{icon}</span>
            <div className="notif-body">
              <p className="notif-text">
                <strong>{n.actor?.name || 'Someone'}</strong> {text}
              </p>
              <span className="notif-time">{formatRelativeTime(n.created_at)}</span>
            </div>
            <span className="notif-arrow">›</span>
          </div>
        );
      })}
    </div>
  );
};

NotificationList.propTypes = {
  notifications: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  onMarkRead: PropTypes.func,
  unreadCount: PropTypes.number,
  onNotificationClick: PropTypes.func,
};

export default memo(NotificationList);
