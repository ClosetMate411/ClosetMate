import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../../services/api.service';
import useWardrobeStore from '../../../store/wardrobeStore';
import { palette } from '../../../theme/colors';

const getItemImage = (item) => item?.image || item?.image_url || item?.processed_image_url || item?.processedImageUrl || null;

function ShareOutfitModal({ visible, onClose, onShare }) {
  const wardrobeItems = useWardrobeStore((s) => s.items);
  const fetchWardrobeItems = useWardrobeStore((s) => s.fetchItems);

  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [description, setDescription] = useState('');
  const bodyScrollRef = useRef(null);

  const wardrobeMap = useMemo(() => {
    const map = new Map();
    for (const item of Array.isArray(wardrobeItems) ? wardrobeItems : []) {
      if (item?.id) map.set(String(item.id), item);
    }
    return map;
  }, [wardrobeItems]);

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    try {
      await fetchWardrobeItems().catch(() => []);
      const res = await apiService.getOutfits();
      const list = Array.isArray(res?.data) ? res.data : [];
      setOutfits(list);
    } catch (_e) {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [fetchWardrobeItems]);

  useEffect(() => {
    if (!visible) {
      setSharing(false);
      setSelectedId('');
      setDescription('');
      return;
    }
    fetchOutfits();
  }, [visible, fetchOutfits]);

  const shareableOutfits = useMemo(
    () => outfits.filter((outfit) => !outfit?.is_shareable),
    [outfits]
  );
  const hasSelection = selectedId !== '';

  useEffect(() => {
    if (!visible) return;
    if (shareableOutfits.length === 0) {
      setSelectedId('');
      return;
    }
    const selectedStillExists = shareableOutfits.some((outfit) => String(outfit?.id || outfit?._id || '') === selectedId);
    if (!selectedStillExists) {
      setSelectedId(String(shareableOutfits[0]?.id || shareableOutfits[0]?._id || ''));
    }
  }, [visible, shareableOutfits, selectedId]);

  const getPreviewItems = useCallback((outfit) => {
    if (Array.isArray(outfit?.items) && outfit.items.length > 0) {
      return outfit.items.slice(0, 4);
    }
    const ids = Array.isArray(outfit?.item_ids) ? outfit.item_ids.slice(0, 4) : [];
    return ids.map((id) => wardrobeMap.get(String(id))).filter(Boolean);
  }, [wardrobeMap]);

  const handleShare = useCallback(async () => {
    if (!hasSelection || sharing) return;
    setSharing(true);
    try {
      const result = await onShare?.(selectedId, description.trim() || null);
      if (result?.success !== false) {
        Alert.alert('Shared!', 'Your outfit has been shared with the community.');
        onClose?.();
      } else {
        Alert.alert('Share Failed', result?.error || 'Could not share outfit.');
      }
    } catch (e) {
      Alert.alert('Share Failed', e.message || 'Could not share outfit.');
    } finally {
      setSharing(false);
    }
  }, [description, hasSelection, onClose, onShare, selectedId, sharing]);

  const renderOutfit = (item) => {
    const outfitId = String(item?.id || item?._id || '');
    const isSelected = selectedId === outfitId;
    const previewItems = getPreviewItems(item);
    const tags = [item?.style, item?.season].filter(Boolean).slice(0, 2);

    return (
      <Pressable
        key={String(outfitId)}
        onPress={() => setSelectedId(outfitId)}
        style={{
          width: '100%',
          borderWidth: 1,
          borderColor: isSelected ? palette.primary : palette.border,
          borderRadius: 14,
          padding: 10,
          backgroundColor: palette.surface,
          marginBottom: 10,
        }}
      >
        <View style={{ borderRadius: 10, overflow: 'hidden', gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[0, 1].map((idx) => {
              const preview = previewItems[idx];
              const image = getItemImage(preview);
              return (
                <View
                  key={`${outfitId || 'outfit'}-top-${idx}`}
                  style={{
                    flex: 1,
                    height: 88,
                    backgroundColor: palette.surfaceSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {image ? (
                    <Image source={{ uri: image }} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                  ) : (
                    <Ionicons name="shirt-outline" size={22} color={palette.borderStrong} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[2, 3].map((idx) => {
              const preview = previewItems[idx];
              const image = getItemImage(preview);
              return (
                <View
                  key={`${outfitId || 'outfit'}-bottom-${idx}`}
                  style={{
                    flex: 1,
                    height: 88,
                    backgroundColor: palette.surfaceSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {image ? (
                    <Image source={{ uri: image }} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                  ) : (
                    <Ionicons name="shirt-outline" size={22} color={palette.borderStrong} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <Text numberOfLines={2} style={{ marginTop: 10, fontSize: 20, fontWeight: '800', color: palette.text }}>
          {item?.name || 'Outfit'}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {tags.map((tag) => (
            <View
              key={`${outfitId}-${tag}`}
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: palette.surfaceSoft,
              }}
            >
              <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: '600' }}>
                {String(tag).replace(/[_-]/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.overlay }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: palette.surface, borderRadius: 22, padding: 18, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text }}>Share an Outfit</Text>
              <Pressable onPress={onClose} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={palette.primary} />
              </View>
            ) : shareableOutfits.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
                <Ionicons name="sparkles-outline" size={42} color={palette.borderStrong} />
                <Text style={{ color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>
                  {outfits.length === 0
                    ? 'You have no saved outfits yet.\nGenerate and save some first!'
                    : 'All your outfits are already shared with the community.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={bodyScrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                <Text style={{ color: palette.textMuted, fontWeight: '800', fontSize: 14, letterSpacing: 1, marginBottom: 10 }}>
                  SELECT AN OUTFIT
                </Text>

                {shareableOutfits.map(renderOutfit)}

                <Text style={{ color: palette.textMuted, fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>
                  DESCRIPTION <Text style={{ fontWeight: '500' }}>(optional)</Text>
                </Text>
                <TextInput
                  value={description}
                  onChangeText={(text) => setDescription(text.slice(0, 500))}
                  placeholder="Share what makes this outfit special..."
                  placeholderTextColor={palette.textMuted}
                  multiline
                  textAlignVertical="top"
                  returnKeyType="default"
                  onFocus={() => {
                    setTimeout(() => bodyScrollRef.current?.scrollToEnd({ animated: true }), 120);
                  }}
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: 14,
                    minHeight: 96,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: palette.text,
                    fontSize: 17,
                    backgroundColor: palette.surface,
                  }}
                />
                <Text style={{ alignSelf: 'flex-end', marginTop: 6, color: palette.textMuted, fontSize: 12 }}>
                  {description.length}/500
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={onClose}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 48,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: palette.border,
                      backgroundColor: palette.surfaceSoft,
                    }}
                  >
                    <Text style={{ color: palette.textMuted, fontSize: 17, fontWeight: '700' }}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleShare}
                    disabled={!hasSelection || sharing}
                    style={{
                      flex: 1.4,
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: palette.primary,
                      opacity: (!hasSelection || sharing) ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
                      {sharing ? 'Sharing...' : 'Share to Community'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default memo(ShareOutfitModal);
