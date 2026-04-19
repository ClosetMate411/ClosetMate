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

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const CommentsModal = ({ opened, onClose, feedItem, onCommentAdded, onCommentDeleted }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null); // 'moderation' | 'rate_limit' | null
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionTimerRef = useRef(null);
  const commentTimestampsRef = useRef([]);
  const countdownRef = useRef(null);
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
      setWarning(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, feedItem]);

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startRateLimitCountdown = useCallback((seconds) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setWarning('rate_limit');
    setRateLimitSecondsLeft(seconds);
    countdownRef.current = setInterval(() => {
      setRateLimitSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setWarning(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || submitting) return;

      // Client-side rate limit — prevents hammering Gemini moderation API
      const now = Date.now();
      commentTimestampsRef.current = commentTimestampsRef.current.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      if (commentTimestampsRef.current.length >= RATE_LIMIT_MAX) {
        const oldest = Math.min(...commentTimestampsRef.current);
        const secsLeft = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
        startRateLimitCountdown(secsLeft);
        return;
      }

      setSubmitting(true);
      setError(null);
      setWarning(null);
      try {
        const response = await apiService.addComment(feedItem.id, trimmed);
        commentTimestampsRef.current.push(Date.now());
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
        setReplyingTo(null);
        onCommentAdded(feedItem.id);
      } catch (err) {
        const code = err.data?.error?.code;
        if (code === 'COMMENT_REJECTED') {
          setWarning('moderation');
        } else if (code === 'RATE_LIMIT_EXCEEDED' || err.status === 429) {
          startRateLimitCountdown(60);
        } else {
          setError(err.message || 'Failed to post comment.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [text, submitting, feedItem, user, onCommentAdded, startRateLimitCountdown]
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

  // ── Mention autocomplete ──
  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    setText(val);

    // Sync replyingTo with text content
    const firstMention = val.match(/^@([A-Za-zğüşıöçĞÜŞİÖÇ\s]+)/);
    if (firstMention) {
      setReplyingTo(firstMention[1].trim());
    } else {
      setReplyingTo(null);
    }

    // Detect @mention trigger at cursor
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([A-Za-zğüşıöçĞÜŞİÖÇ\s]*)$/);

    if (atMatch) {
      const query = atMatch[1];
      setMentionQuery(query);
      setMentionIndex(0);

      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
      mentionTimerRef.current = setTimeout(async () => {
        try {
          const res = await apiService.searchUsers(query || '');
          setMentionResults(res.data || []);
        } catch {
          setMentionResults([]);
        }
      }, 150);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, []);

  const insertMention = useCallback((selectedUser) => {
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const atPos = textBefore.lastIndexOf('@');
    const newText = textBefore.slice(0, atPos) + `@${selectedUser.name} ` + textAfter;
    setText(newText);
    setMentionQuery(null);
    setMentionResults([]);
    // Update replyingTo if this is the first mention
    const firstMention = newText.match(/^@([A-Za-zğüşıöçĞÜŞİÖÇ\s]+)/);
    setReplyingTo(firstMention ? firstMention[1].trim() : null);
    inputRef.current?.focus();
  }, [text]);

  const handleReply = useCallback((comment) => {
    const name = comment.user.name;
    setReplyingTo(name);
    setText(`@${name} `);
    inputRef.current?.focus();
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setText('');
  }, []);

  const handleKeyDown = (e) => {
    // Mention dropdown navigation
    if (mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
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
        {/* Reply indicator */}
        {replyingTo && (
          <div className="comment-reply-bar">
            <span>Replying to <strong>@{replyingTo}</strong></span>
            <button className="comment-reply-cancel" onClick={cancelReply} type="button">&times;</button>
          </div>
        )}

        {/* Input */}
        <div className="comment-input-wrapper">
          <form className="comment-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="comment-input"
              placeholder={replyingTo ? `Reply to @${replyingTo}…` : "Write a comment… Type @ to mention"}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={submitting}
              aria-label="Comment text"
            />
            <button
              className="comment-submit-btn"
              type="submit"
              disabled={!text.trim() || submitting || warning === 'rate_limit'}
              aria-label="Post comment"
            >
              <IconSend size={17} />
            </button>
          </form>

          {/* Mention autocomplete dropdown */}
          {mentionResults.length > 0 && (
            <div className="mention-dropdown">
              {mentionResults.map((u, i) => (
                <button
                  key={u.user_id}
                  className={`mention-option${i === mentionIndex ? ' active' : ''}`}
                  onClick={() => insertMention(u)}
                  type="button"
                >
                  <span className="mention-avatar">{u.name.charAt(0).toUpperCase()}</span>
                  <span className="mention-name">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Warnings */}
        {warning === 'moderation' && (
          <div className="comment-warning comment-warning--moderation" role="alert">
            <span className="comment-warning-icon">⚠️</span>
            <span className="comment-warning-text">
              Your comment appears to violate our community guidelines. Please keep the conversation respectful and revise before reposting.
            </span>
            <button className="comment-warning-dismiss" onClick={() => setWarning(null)} aria-label="Dismiss">&times;</button>
          </div>
        )}
        {warning === 'rate_limit' && (
          <div className="comment-warning comment-warning--rate-limit" role="alert">
            <span className="comment-warning-icon">🕐</span>
            <span className="comment-warning-text">
              You're posting too fast. Please wait <strong>{rateLimitSecondsLeft}s</strong> before commenting again.
            </span>
          </div>
        )}

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
                  <div className="comment-actions">
                    {comment.user.is_self && (
                      <button className="comment-action-btn comment-action-delete" onClick={() => handleDelete(comment.id)}>
                        Delete
                      </button>
                    )}
                    {!comment.user.is_self && (
                      <button className="comment-reply-btn" onClick={() => handleReply(comment)}>
                        Reply
                      </button>
                    )}
                  </div>
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
