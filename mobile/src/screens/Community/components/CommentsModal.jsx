import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator, Alert, Keyboard, Modal, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../../../services/api.service';
import useAuthStore from '../../../store/authStore';
import { palette } from '../../../theme/colors';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${month} ${day}, ${String(hour12).padStart(2, '0')}:${minutes} ${ampm}`;
};
const AVATAR_GRADIENT = ['#7c3aed', '#c026d3'];

const CommentAvatar = memo(function CommentAvatar({ avatarUrl, letter }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [avatarUrl]);

  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden' }}>
      <LinearGradient
        colors={AVATAR_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{letter}</Text>
      </LinearGradient>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            opacity: loaded ? 1 : 0,
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      ) : null}
    </View>
  );
});

function CommentsModal({ visible, onClose, shareItem, onCommentAdded, onCommentDeleted, onNavigateToProfile }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [cursorPos, setCursorPos] = useState(0);
  const currentUser = useAuthStore((s) => s.user);
  const mentionTimerRef = useRef(null);
  const inputRef = useRef(null);

  const shareId = shareItem?.id || shareItem?._id;

  const fetchComments = useCallback(async () => {
    if (!shareId) return;
    setLoading(true);
    try {
      const response = await apiService.getComments(shareId);
      const list = Array.isArray(response?.data) ? response.data : [];
      setComments(list);
    } catch (_e) {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (visible && shareId) {
      fetchComments();
    }
    if (!visible) {
      setComments([]);
      setText('');
      setReplyingTo(null);
      setReplyToCommentId(null);
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, [visible, shareId, fetchComments]);

  useEffect(() => () => {
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
  }, []);

  useEffect(() => {
    const avatarUrls = Array.from(new Set(
      comments
        .map((comment) => comment?.user?.avatar_url || comment?.user?.avatarUrl)
        .filter(Boolean)
    ));

    avatarUrls.forEach((avatarUrl) => {
      Image.prefetch(avatarUrl).catch(() => {});
    });
  }, [comments]);

  const runMentionSearch = useCallback((query) => {
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
    mentionTimerRef.current = setTimeout(async () => {
      try {
        const response = await apiService.searchUsers(query || '');
        const list = Array.isArray(response?.data) ? response.data : [];
        setMentionResults(list);
      } catch {
        setMentionResults([]);
      }
    }, 150);
  }, []);

  const handleTextChange = useCallback((value) => {
    setText(value);
    const firstMention = value.match(/^@([A-Za-z0-9ğüşıöçĞÜŞİÖÇ._\s]+)/);
    setReplyingTo(firstMention ? firstMention[1].trim() : null);
    if (!firstMention) {
      setReplyToCommentId(null);
    }
    const currentCursor = Math.min(cursorPos, value.length);
    const textBefore = value.slice(0, currentCursor);
    const atMatch = textBefore.match(/@([A-Za-z0-9ğüşıöçĞÜŞİÖÇ._\s]*)$/) || value.match(/@([A-Za-z0-9ğüşıöçĞÜŞİÖÇ._\s]*)$/);
    if (atMatch) {
      const query = atMatch[1] || '';
      setMentionQuery(query);
      runMentionSearch(query.trimStart());
      return;
    }
    setMentionQuery(null);
    setMentionResults([]);
  }, [cursorPos, runMentionSearch]);

  const getMentionName = (user) => user?.name || user?.full_name || user?.username || 'User';
  const getMentionAvatar = (user) => user?.avatar_url || user?.avatarUrl || null;
  const getMentionKey = (user, index) => String(user?.user_id || user?.id || user?._id || index);

  const insertMention = useCallback((user) => {
    const name = getMentionName(user);
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const atPos = before.lastIndexOf('@');
    if (atPos < 0) return;
    const nextText = `${before.slice(0, atPos)}@${name} ${after}`;
    const nextPos = atPos + name.length + 2;
    setText(nextText);
    const firstMention = nextText.match(/^@([A-Za-z0-9ğüşıöçĞÜŞİÖÇ._\s]+)/);
    setReplyingTo(firstMention ? firstMention[1].trim() : null);
    setCursorPos(nextPos);
    setMentionQuery(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps?.({ selection: { start: nextPos, end: nextPos } });
    });
  }, [text, cursorPos]);

  const handleReply = useCallback((comment) => {
    const name = comment?.user?.full_name || comment?.user?.name || 'User';
    const commentId = comment?.id || comment?._id;
    const replyText = `@${name} `;
    setReplyingTo(name);
    setReplyToCommentId(commentId || null);
    setText(replyText);
    setCursorPos(replyText.length);
    setMentionQuery(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps?.({ selection: { start: replyText.length, end: replyText.length } });
    });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyToCommentId(null);
    setText('');
    setMentionQuery(null);
    setMentionResults([]);
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !shareId) return;
    setSending(true);
    Keyboard.dismiss();
    try {
      await apiService.addComment(shareId, trimmed, replyToCommentId);
      setText('');
      setReplyingTo(null);
      setReplyToCommentId(null);
      setMentionQuery(null);
      setMentionResults([]);
      onCommentAdded?.(shareId);
      await fetchComments();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not post comment.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteComment(commentId);
            setComments((prev) => prev.filter((c) => (c.id || c._id) !== commentId));
            onCommentDeleted?.(shareId);
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  const isOwn = (comment) => {
    const userId =
      currentUser?.id ||
      currentUser?._id ||
      currentUser?.user_id ||
      currentUser?.userId;
    const commentUserId =
      comment?.user?.id ||
      comment?.user?._id ||
      comment?.user?.user_id ||
      comment?.user?.userId ||
      comment?.user_id ||
      comment?.userId;
    return userId && commentUserId && String(userId) === String(commentUserId);
  };

  const renderComment = ({ item }) => {
    const name = item?.user?.full_name || item?.user?.name || 'User';
    const avatarUrl = item?.user?.avatar_url || item?.user?.avatarUrl || null;
    const letter = name.charAt(0).toUpperCase();
    const commentUserId = item?.user?.id || item?.user?._id || item?.user?.user_id || item?.user_id;
    const ownComment = isOwn(item);

    const handleProfileClick = () => {
      console.log('Clicked comment user id:', commentUserId, 'Full user:', item?.user);
      if (!commentUserId) {
        Alert.alert('Opps', 'Bu kullanıcının profili bulunamadı.');
        return;
      }
      onNavigateToProfile?.(commentUserId);
    };

    return (
      <View style={{
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 8,
      }}>
        {/* Avatar */}
        <Pressable onPress={handleProfileClick}>
          <CommentAvatar avatarUrl={avatarUrl} letter={letter} />
        </Pressable>

        {/* Bubble */}
        <View style={{
          flex: 1,
          backgroundColor: '#f0e8ff',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}>
          {/* Name + Date row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Pressable onPress={handleProfileClick}>
              <Text style={{ fontWeight: '700', color: palette.text, fontSize: 14 }}>{name}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.textMuted, fontSize: 11 }}>
                {formatDateTime(item?.created_at || item?.createdAt)}
              </Text>
              {ownComment ? (
                <Pressable onPress={() => handleDelete(item.id || item._id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={palette.danger} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Comment text */}
          <Text style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}>
            {item?.text || item?.content || ''}
          </Text>

          {/* Reply / Delete */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            {ownComment ? (
              <Pressable onPress={() => handleDelete(item.id || item._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trash-outline" size={14} color={palette.danger} />
                <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '700' }}>Delete</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => handleReply(item)}>
                <Text style={{ color: palette.primaryStrong, fontSize: 13, fontWeight: '700' }}>Reply</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: palette.overlay }}
          onPress={() => { Keyboard.dismiss(); onClose(); }}
        />
        <View style={{
          maxHeight: '75%', backgroundColor: palette.surface,
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          padding: 16,
        }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: palette.text }}>
                Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
              </Text>
              <Pressable onPress={onClose} style={{ padding: 6, borderWidth: 1.5, borderColor: palette.primary, borderRadius: 10 }}>
                <Ionicons name="close" size={22} color={palette.primary} />
              </Pressable>
            </View>

            {/* Input */}
            {replyingTo ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                  marginBottom: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 12,
                  backgroundColor: palette.surfaceSoft,
                }}
              >
                <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                  Replying to <Text style={{ color: palette.text, fontWeight: '700' }}>@{replyingTo}</Text>
                </Text>
                <Pressable onPress={cancelReply} hitSlop={8}>
                  <Ionicons name="close" size={16} color={palette.textMuted} />
                </Pressable>
              </View>
            ) : null}

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 6, marginBottom: 10,
            }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPos(e?.nativeEvent?.selection?.start ?? 0)}
                placeholder={replyingTo ? `Reply to @${replyingTo}...` : 'Write a comment... Type @ to mention'}
                placeholderTextColor={palette.textMuted}
                editable={!sending}
                multiline
                textAlignVertical="top"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: mentionQuery != null ? palette.primary : palette.borderStrong,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: palette.surface,
                  color: palette.text,
                  maxHeight: 80,
                  fontSize: 15,
                }}
              />
              <Pressable
                onPress={handleSend}
                disabled={sending || !text.trim()}
                style={{
                  width: 46, height: 46, borderRadius: 16,
                  backgroundColor: text.trim() ? palette.primary : palette.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="paper-plane-outline" size={20} color={text.trim() ? '#fff' : palette.primaryStrong} />
                )}
              </Pressable>
            </View>

            {mentionResults.length > 0 ? (
              <View style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 14,
                backgroundColor: palette.surfaceElevated,
                maxHeight: 200,
                marginBottom: 10,
                overflow: 'hidden',
              }}>
                <FlatList
                  data={mentionResults}
                  keyExtractor={getMentionKey}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item, index }) => {
                    const name = getMentionName(item);
                    const avatarUrl = getMentionAvatar(item);
                    return (
                      <Pressable
                        onPress={() => insertMention(item)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: index === 0 ? palette.primarySoft : palette.surfaceElevated,
                        }}
                      >
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                        ) : (
                          <LinearGradient
                            colors={AVATAR_GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
                          </LinearGradient>
                        )}
                        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>{name}</Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            ) : null}

            {/* Comment List */}
            <View style={{ minHeight: 160, maxHeight: 320 }}>
              {loading ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <ActivityIndicator color={palette.primary} />
                </View>
              ) : comments.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Text style={{ color: palette.textMuted, marginTop: 8, fontSize: 17 }}>
                    No comments yet — be the first!
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => String(c.id || c._id || Math.random())}
                  renderItem={renderComment}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default memo(CommentsModal);
