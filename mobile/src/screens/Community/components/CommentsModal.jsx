import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../../services/api.service';
import useAuthStore from '../../../store/authStore';
import { palette } from '../../../theme/colors';

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

function CommentsModal({ visible, onClose, shareItem }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

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
    }
  }, [visible, shareId, fetchComments]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !shareId) return;
    setSending(true);
    Keyboard.dismiss();
    try {
      await apiService.addComment(shareId, trimmed);
      setText('');
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
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  const isOwn = (comment) => {
    const userId = currentUser?.id || currentUser?._id;
    const commentUserId = comment?.user?.id || comment?.user?._id || comment?.user_id;
    return userId && commentUserId && String(userId) === String(commentUserId);
  };

  const renderComment = ({ item }) => {
    const name = item?.user?.full_name || item?.user?.name || 'User';
    const letter = name.charAt(0).toUpperCase();
    return (
      <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: palette.primarySoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>{letter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontWeight: '700', color: palette.text, fontSize: 13 }}>{name}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 11 }}>{formatTimeAgo(item?.created_at || item?.createdAt)}</Text>
          </View>
          <Text style={{ color: palette.text, marginTop: 3, fontSize: 14, lineHeight: 20 }}>{item?.text || item?.content || ''}</Text>
        </View>
        {isOwn(item) && (
          <Pressable onPress={() => handleDelete(item.id || item._id)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color={palette.danger} />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'flex-end' }}>
          <View style={{
            maxHeight: '75%', backgroundColor: palette.surface,
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            padding: 16,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text }}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>
              <Pressable onPress={onClose} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            {/* Comment List */}
            {loading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Ionicons name="chatbubbles-outline" size={36} color={palette.borderStrong} />
                <Text style={{ color: palette.textMuted, marginTop: 8 }}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => String(c.id || c._id || Math.random())}
                renderItem={renderComment}
                style={{ flexGrow: 0, maxHeight: 320 }}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* Input */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12,
            }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Write a comment..."
                placeholderTextColor={palette.textMuted}
                editable={!sending}
                multiline
                style={{
                  flex: 1, borderWidth: 1, borderColor: palette.borderStrong,
                  borderRadius: 10, padding: 10, backgroundColor: palette.surface,
                  color: palette.text, maxHeight: 80,
                }}
              />
              <Pressable
                onPress={handleSend}
                disabled={sending || !text.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: text.trim() ? palette.primary : palette.surfaceSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color={text.trim() ? '#fff' : palette.textMuted} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default memo(CommentsModal);
