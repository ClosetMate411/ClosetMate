import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../../services/api.service';
import { palette } from '../../../theme/colors';

function ShareOutfitModal({ visible, onClose, onShare }) {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(null);

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getOutfits();
      const list = Array.isArray(res?.data) ? res.data : [];
      setOutfits(list);
    } catch (_e) {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchOutfits();
    if (!visible) setSharing(null);
  }, [visible, fetchOutfits]);

  const handleShare = async (outfit) => {
    const outfitId = outfit?.id || outfit?._id;
    if (!outfitId || sharing) return;
    setSharing(outfitId);
    try {
      const result = await onShare?.(outfitId);
      if (result?.success !== false) {
        Alert.alert('Shared!', 'Your outfit has been shared with the community.');
        onClose?.();
      } else {
        Alert.alert('Share Failed', result?.error || 'Could not share outfit.');
      }
    } catch (e) {
      Alert.alert('Share Failed', e.message || 'Could not share outfit.');
    } finally {
      setSharing(null);
    }
  };

  const renderOutfit = ({ item }) => {
    const outfitId = item?.id || item?._id;
    const isCurrent = sharing === outfitId;
    return (
      <Pressable
        onPress={() => handleShare(item)}
        disabled={!!sharing}
        style={{
          borderWidth: 1, borderColor: palette.border, borderRadius: 12,
          padding: 14, backgroundColor: palette.surface, gap: 6,
          opacity: sharing && !isCurrent ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, flex: 1 }}>
            {item?.name || 'Outfit'}
          </Text>
          {isCurrent ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Ionicons name="share-outline" size={18} color={palette.primary} />
          )}
        </View>
        <Text style={{ color: palette.textMuted, fontSize: 12 }}>
          {item?.item_ids?.length || item?.items?.length || 0} items
          {item?.style ? ` · ${item.style}` : ''}
          {item?.occasion ? ` · ${item.occasion}` : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'center', padding: 20 }}>
        <View style={{
          backgroundColor: palette.surface, borderRadius: 22,
          padding: 18, maxHeight: '80%',
        }}>
          {/* Header */}
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
          ) : outfits.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
              <Ionicons name="sparkles-outline" size={42} color={palette.borderStrong} />
              <Text style={{ color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>
                You have no saved outfits yet.{'\n'}Generate and save some first!
              </Text>
            </View>
          ) : (
            <FlatList
              data={outfits}
              keyExtractor={(o) => String(o.id || o._id || Math.random())}
              renderItem={renderOutfit}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default memo(ShareOutfitModal);
