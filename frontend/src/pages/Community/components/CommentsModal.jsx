import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '@mantine/core';
import { IconSend, IconTrash } from '@tabler/icons-react';
import apiService from '../../../services/api.service';
import useAuthStore from '../../../store/authStore';
import './CommentsModal.css';

const formatCommentDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CommentsModal = ({ opened, onClose, feedItem, onCommentAdded, onCommentDeleted }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef(null);

  const fetchComments = useCallback(async () => {
    if (!feedItem) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getComments(feedItem.id);
      setComments(response.data || []);
    } catch {
      setError('Failed to load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [feedItem]);

  useEffect(() => {
    if (opened && feedItem) {
      fetchComments();
      setText('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, feedItem]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || submitting) return;

      setSubmitting(true);
      setError(null);
      try {
        const response = await apiService.addComment(feedItem.id, trimmed);
        // Backend doesn't return user info in comment response, so we enrich locally
        const newComment = {
          ...response.data,
          user: {
            user_id: user?.id || '',
            name: user?.full_name || 'You',
            is_self: true,
          },
        };
        setComments((prev) => [newComment, ...prev]);
        setText('');
        onCommentAdded(feedItem.id);
      } catch (err) {
        setError(err.message || 'Failed to post comment.');
      } finally {
        setSubmitting(false);
      }
    },
    [text, submitting, feedItem, user, onCommentAdded]
  );

  const handleDelete = useCallback(
    async (commentId) => {
      setError(null);
      try {
        await apiService.deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onCommentDeleted(feedItem.id);
      } catch (err) {
        setError(err.message || 'Failed to delete comment.');
      }
    },
    [feedItem, onCommentDeleted]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const totalCount = feedItem?.comment_count ?? comments.length;
  const modalTitle = `Comments${totalCount > 0 ? ` · ${totalCount}` : ''}`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      centered
      size="md"
    >
      <div className="comments-modal">
        {/* Input */}
        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="comment-input"
            placeholder="Write a comment… (Enter to send)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={1000}
            disabled={submitting}
            aria-label="Comment text"
          />
          <button
            className="comment-submit-btn"
            type="submit"
            disabled={!text.trim() || submitting}
            aria-label="Post comment"
          >
            <IconSend size={17} />
          </button>
        </form>

        {/* Error */}
        {error && <p className="comments-error">{error}</p>}

        {/* List */}
        <div className="comments-list">
          {loading && (
            <div className="comments-loading">
              <div className="comments-spinner" />
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="comments-empty">
              <p>No comments yet — be the first!</p>
            </div>
          )}

          {!loading &&
            comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar" aria-hidden="true">
                  {comment.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-username">
                      {comment.user.name}
                      {comment.user.is_self && (
                        <span className="comment-you-badge">You</span>
                      )}
                    </span>
                    <span className="comment-time">
                      {comment.created_at ? formatCommentDate(comment.created_at) : ''}
                    </span>
                    {comment.user.is_self && (
                      <button
                        className="comment-delete-btn"
                        onClick={() => handleDelete(comment.id)}
                        title="Delete comment"
                        aria-label="Delete your comment"
                      >
                        <IconTrash size={13} />
                      </button>
                    )}
                  </div>
                  <p className="comment-text">{comment.text}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
};

CommentsModal.propTypes = {
  opened: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  feedItem: PropTypes.object,
  onCommentAdded: PropTypes.func.isRequired,
  onCommentDeleted: PropTypes.func.isRequired,
};

export default memo(CommentsModal);
