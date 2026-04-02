import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/api.service';
import useWardrobeStore from '../../store/wardrobeStore';
import { palette } from '../../theme/colors';

const OCCASION_OPTIONS = [
  { label: 'Everyday', value: 'everyday' },
  { label: 'Work', value: 'work' },
  { label: 'Formal Event', value: 'formal_event' },
  { label: 'Date Night', value: 'date_night' },
  { label: 'Party', value: 'party' },
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Gym', value: 'gym' },
  { label: 'Beach', value: 'beach' },
  { label: 'Travel', value: 'travel' },
  { label: 'Lounging', value: 'lounging' },
  { label: 'Wedding', value: 'wedding' },
];

const STYLE_OPTIONS = [
  { label: 'Any Style', value: 'any' },
  { label: 'Casual', value: 'casual' },
  { label: 'Formal', value: 'formal' },
  { label: 'Business Casual', value: 'business_casual' },
  { label: 'Smart Casual', value: 'smart_casual' },
  { label: 'Sporty', value: 'sporty' },
  { label: 'Streetwear', value: 'streetwear' },
  { label: 'Bohemian', value: 'bohemian' },
  { label: 'Minimalist', value: 'minimalist' },
  { label: 'Preppy', value: 'preppy' },
  { label: 'Vintage', value: 'vintage' },
  { label: 'Classic', value: 'classic' },
  { label: 'Athleisure', value: 'athleisure' },
];

const OUTFIT_COUNT_OPTIONS = [1, 2, 3, 4, 5];

const getItemImage = (item) =>
  item?.image ||
  item?.image_url ||
  item?.processed_image_url ||
  item?.processedImageUrl ||
  null;

const getItemName = (item, idx) => item?.name || item?.item_name || `Item ${idx + 1}`;

const getItemIdentifier = (item) => item?.item_id || item?.id || item?._id || item?.wardrobe_item_id || null;

export default function OutfitsScreen() {
  const wardrobeItems = useWardrobeStore((s) => s.items);
  const fetchWardrobeItems = useWardrobeStore((s) => s.fetchItems);
  const setAiLabels = useWardrobeStore((s) => s.setAiLabels);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [generatedOutfits, setGeneratedOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatedFavorites, setGeneratedFavorites] = useState({});
  const [generateConfigOpen, setGenerateConfigOpen] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState('everyday');
  const [selectedStyle, setSelectedStyle] = useState('any');
  const [selectedCount, setSelectedCount] = useState(3);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  const extractAiLabels = useCallback((outfits) => {
    const labels = {};
    for (const outfit of outfits) {
      const items = Array.isArray(outfit?.items) ? outfit.items : [];
      for (const item of items) {
        const id = item?.item_id || item?.id || item?._id || item?.wardrobe_item_id;
        const name = item?.name || item?.item_name;
        if (id && name && name.trim()) {
          labels[String(id)] = name.trim();
        }
      }
    }
    if (Object.keys(labels).length > 0) {
      setAiLabels(labels);
    }
  }, [setAiLabels]);

  const loadOutfits = useCallback(async () => {
    setLoading(true);
    try {
      await fetchWardrobeItems().catch(() => []);
      const res = await apiService.getOutfits();
      const list = Array.isArray(res?.data) ? res.data : [];
      setSavedOutfits(list);

      // Extract AI labels from outfit details
      const detailPromises = list.map(async (outfit) => {
        if (outfit?.items && outfit.items.length > 0) return outfit;
        if (!outfit?.id) return outfit;
        try {
          const detail = await apiService.getOutfit(outfit.id);
          return detail?.data || outfit;
        } catch {
          return outfit;
        }
      });
      const detailedOutfits = await Promise.all(detailPromises);
      extractAiLabels(detailedOutfits);
    } catch (e) {
      setSavedOutfits([]);
      Alert.alert('Outfits', e.message || 'Failed to load outfits');
    } finally {
      setLoading(false);
    }
  }, [fetchWardrobeItems, extractAiLabels]);

  useEffect(() => {
    loadOutfits();
  }, [loadOutfits]);

  useFocusEffect(
    useCallback(() => {
      loadOutfits();
    }, [loadOutfits])
  );

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await apiService.generateOutfits({
        count: selectedCount,
        season: 'all',
        occasion: selectedOccasion,
        style: selectedStyle,
      });
      const generated = Array.isArray(res?.data?.outfits) ? res.data.outfits : [];
      setGeneratedOutfits(generated);
      extractAiLabels(generated);
      setGenerateConfigOpen(false);
      setOccasionOpen(false);
      setStyleOpen(false);
      setCountOpen(false);
      Alert.alert('Success', `New outfits generated (${generated.length}).`);
    } catch (e) {
      Alert.alert('Generate failed', e.message || 'Could not generate outfits');
    } finally {
      setGenerating(false);
    }
  };

  const wardrobeItemMap = useMemo(() => {
    const entries = (Array.isArray(wardrobeItems) ? wardrobeItems : [])
      .map((item) => [String(item?.id), item])
      .filter(([id]) => id && id !== 'undefined');
    return new Map(entries);
  }, [wardrobeItems]);

  const enrichOutfitItems = useCallback((outfit) => {
    const items = Array.isArray(outfit?.items) ? outfit.items : [];
    return items.map((item, idx) => {
      const wardrobeMatch = wardrobeItemMap.get(String(getItemIdentifier(item)));
      return {
        ...wardrobeMatch,
        ...item,
        id: getItemIdentifier(item) || wardrobeMatch?.id || `${idx}`,
        image: getItemImage(item) || getItemImage(wardrobeMatch),
        name: getItemName(item, idx) || getItemName(wardrobeMatch, idx),
      };
    });
  }, [wardrobeItemMap]);

  const normalizeOutfitForDetail = useCallback((outfit) => ({
    ...outfit,
    items: enrichOutfitItems(outfit),
  }), [enrichOutfitItems]);

  const openOutfitDetail = useCallback(async (outfit) => {
    if (!outfit) return;

    // Generated outfits already include rich details.
    if (!outfit?.id || outfit?.items) {
      setSelectedOutfit(normalizeOutfitForDetail(outfit));
      setDetailOpen(true);
      return;
    }

    // Saved outfits: fetch full detail by id.
    setDetailLoading(true);
    try {
      const res = await apiService.getOutfit(outfit.id);
      setSelectedOutfit(normalizeOutfitForDetail(res?.data || outfit));
      setDetailOpen(true);
    } catch (e) {
      Alert.alert('Outfit detail', e.message || 'Could not load outfit details');
    } finally {
      setDetailLoading(false);
    }
  }, [normalizeOutfitForDetail]);

  const allOutfits = useMemo(() => {
    const combined = [...generatedOutfits, ...savedOutfits];
    return combined.sort((a, b) => {
      const aFav = a?.id
        ? !!(a?.is_favorite || a?.isFavorite || a?.favorite)
        : !!generatedFavorites[getGeneratedOutfitKey(a, combined.indexOf(a))];
      const bFav = b?.id
        ? !!(b?.is_favorite || b?.isFavorite || b?.favorite)
        : !!generatedFavorites[getGeneratedOutfitKey(b, combined.indexOf(b))];
      return (bFav ? 1 : 0) - (aFav ? 1 : 0);
    });
  }, [generatedOutfits, savedOutfits, generatedFavorites, getGeneratedOutfitKey]);
  const selectedOccasionLabel = OCCASION_OPTIONS.find((option) => option.value === selectedOccasion)?.label || 'Everyday';
  const selectedStyleLabel = STYLE_OPTIONS.find((option) => option.value === selectedStyle)?.label || 'Any Style';

  const getGeneratedOutfitKey = useCallback((outfit, index) => outfit?.id || outfit?.name || `${index}`, []);

  const isFavoriteOutfit = useCallback((outfit, index) => {
    if (!outfit) return false;
    if (outfit?.id) {
      return !!(outfit?.is_favorite || outfit?.isFavorite || outfit?.favorite);
    }
    return !!generatedFavorites[getGeneratedOutfitKey(outfit, index)];
  }, [generatedFavorites, getGeneratedOutfitKey]);

  const toggleFavorite = useCallback(async (outfit, index) => {
    if (!outfit) return;

    if (!outfit?.id) {
      const key = getGeneratedOutfitKey(outfit, index);
      setGeneratedFavorites((prev) => ({ ...prev, [key]: !prev[key] }));
      return;
    }

    const nextValue = !isFavoriteOutfit(outfit, index);
    setSavedOutfits((prev) => prev.map((entry) => (
      entry?.id === outfit.id
        ? { ...entry, is_favorite: nextValue, isFavorite: nextValue, favorite: nextValue }
        : entry
    )));

    try {
      await apiService.toggleFavoriteOutfit(outfit.id);
    } catch (e) {
      setSavedOutfits((prev) => prev.map((entry) => (
        entry?.id === outfit.id
          ? { ...entry, is_favorite: !nextValue, isFavorite: !nextValue, favorite: !nextValue }
          : entry
      )));
      Alert.alert('Favorite failed', e.message || 'Could not update favorite status.');
    }
  }, [getGeneratedOutfitKey, isFavoriteOutfit]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f4f8', paddingHorizontal: 20, paddingTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#111827' }}>Your Outfits</Text>
        <Text style={{ fontSize: 14, color: '#64748b' }}>{allOutfits.length} combinations</Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator size="small" color="#7c3aed" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <Pressable
            onPress={() => setGenerateConfigOpen(true)}
            style={{
              width: 170,
              height: 230,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: '#d7d7dc',
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              marginBottom: 16,
            }}
          >
            <Ionicons name="add" size={42} color="#5f6368" />
            <Text style={{ marginTop: 10, fontSize: 15, color: '#5f6368', fontWeight: '500' }}>
              {generating ? 'Generating...' : 'Generate New Outfit'}
            </Text>
          </Pressable>

          {allOutfits.map((outfit, index) => (
            <Pressable
              key={outfit?.id || `${outfit?.name || 'outfit'}-${index}`}
              onPress={() => openOutfitDetail(outfit)}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 12,
                padding: 12,
                backgroundColor: '#fff',
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' }}>
                  {outfit?.name || `Outfit ${index + 1}`}
                </Text>
                <Pressable onPress={() => toggleFavorite(outfit, index)} hitSlop={8} style={{ padding: 4 }}>
                  <Ionicons
                    name={isFavoriteOutfit(outfit, index) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isFavoriteOutfit(outfit, index) ? '#ef4444' : '#9ca3af'}
                  />
                </Pressable>
              </View>
              <Text style={{ marginTop: 4, color: '#6b7280' }}>
                {(outfit?.item_ids?.length || outfit?.items?.length || 0)} items
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {detailLoading ? (
        <View style={{ position: 'absolute', right: 16, top: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={{ color: '#374151' }}>Loading details...</Text>
        </View>
      ) : null}

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '75%', backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 }}>
                {selectedOutfit?.name || 'Outfit'}
              </Text>
              <Pressable onPress={() => setDetailOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#6b7280', marginBottom: 8 }}>
                {selectedOutfit?.item_ids?.length || selectedOutfit?.items?.length || 0} items
              </Text>

              {selectedOutfit?.reasoning ? (
                <Text style={{ color: '#374151', marginBottom: 10 }}>
                  {selectedOutfit.reasoning}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {selectedOutfit?.style ? <Text style={{ color: '#4b5563' }}>Style: {selectedOutfit.style}</Text> : null}
                {selectedOutfit?.occasion ? <Text style={{ color: '#4b5563' }}>Occasion: {selectedOutfit.occasion}</Text> : null}
                {selectedOutfit?.season ? <Text style={{ color: '#4b5563' }}>Season: {selectedOutfit.season}</Text> : null}
                {selectedOutfit?.cohesion_score ? <Text style={{ color: '#4b5563' }}>Score: {selectedOutfit.cohesion_score}/10</Text> : null}
              </View>

              {Array.isArray(selectedOutfit?.items) && selectedOutfit.items.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                    {selectedOutfit.items.map((item, idx) => {
                      const image = getItemImage(item);
                      return (
                        <View
                          key={getItemIdentifier(item) || `${idx}`}
                          style={{
                            width: 112,
                            borderWidth: 1,
                            borderColor: palette.border,
                            borderRadius: 16,
                            padding: 10,
                            backgroundColor: palette.surface,
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <View style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {image ? (
                              <Image source={{ uri: image }} style={{ width: 72, height: 72 }} resizeMode="contain" />
                            ) : (
                              <Ionicons name="shirt-outline" size={28} color={palette.textMuted} />
                            )}
                          </View>
                          <Text numberOfLines={2} style={{ color: '#111827', fontWeight: '700', textAlign: 'center' }}>
                            {getItemName(item, idx)}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>

                  <View style={{ gap: 8 }}>
                    {selectedOutfit.items.map((item, idx) => (
                      <View key={item?.item_id || item?.id || `${idx}`} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10 }}>
                        <Text style={{ fontWeight: '700', color: '#111827' }}>{getItemName(item, idx)}</Text>
                        <Text style={{ color: '#6b7280' }}>
                          {item?.category || 'unknown'} / {item?.subcategory || 'unknown'} / {item?.color_primary || 'unknown'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={generateConfigOpen} transparent animationType="fade" onRequestClose={() => setGenerateConfigOpen(false)}>
        <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: palette.surface, borderRadius: 22, padding: 18, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: palette.text }}>Generate Outfits</Text>
              <Pressable onPress={() => setGenerateConfigOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 6 }}>
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Occasion</Text>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setOccasionOpen((prev) => !prev);
                      if (styleOpen) setStyleOpen(false);
                      if (countOpen) setCountOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{selectedOccasionLabel}</Text>
                    <Ionicons name={occasionOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {occasionOpen ? (
                    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                      {OCCASION_OPTIONS.map((option, index) => {
                        const active = option.value === selectedOccasion;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setSelectedOccasion(option.value);
                              setOccasionOpen(false);
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 13,
                              borderTopWidth: index === 0 ? 0 : 1,
                              borderTopColor: palette.border,
                              backgroundColor: active ? palette.primarySoft : palette.surface,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: active ? '700' : '500' }}>{option.label}</Text>
                            {active ? <Ionicons name="checkmark" size={18} color={palette.primaryStrong} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Style</Text>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setStyleOpen((prev) => !prev);
                      if (occasionOpen) setOccasionOpen(false);
                      if (countOpen) setCountOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{selectedStyleLabel}</Text>
                    <Ionicons name={styleOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {styleOpen ? (
                    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                      {STYLE_OPTIONS.map((option, index) => {
                        const active = option.value === selectedStyle;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setSelectedStyle(option.value);
                              setStyleOpen(false);
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 13,
                              borderTopWidth: index === 0 ? 0 : 1,
                              borderTopColor: palette.border,
                              backgroundColor: active ? palette.primarySoft : palette.surface,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: active ? '700' : '500' }}>{option.label}</Text>
                            {active ? <Ionicons name="checkmark" size={18} color={palette.primaryStrong} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Number of Outfits</Text>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setCountOpen((prev) => !prev);
                      if (occasionOpen) setOccasionOpen(false);
                      if (styleOpen) setStyleOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{selectedCount}</Text>
                    <Ionicons name={countOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {countOpen ? (
                    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                      {OUTFIT_COUNT_OPTIONS.map((count, index) => {
                        const active = count === selectedCount;
                        return (
                          <Pressable
                            key={count}
                            onPress={() => {
                              setSelectedCount(count);
                              setCountOpen(false);
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 13,
                              borderTopWidth: index === 0 ? 0 : 1,
                              borderTopColor: palette.border,
                              backgroundColor: active ? palette.primarySoft : palette.surface,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: palette.text, fontWeight: active ? '700' : '500' }}>{count}</Text>
                            {active ? <Ionicons name="checkmark" size={18} color={palette.primaryStrong} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <View style={{ marginTop: 18, gap: 10 }}>
              <View style={{ borderRadius: 14, backgroundColor: palette.surfaceSoft, padding: 12 }}>
                <Text style={{ color: palette.textMuted }}>
                  Occasion: {selectedOccasionLabel} | Style: {selectedStyleLabel} | Count: {selectedCount}
                </Text>
              </View>
              <Pressable
                onPress={handleGenerate}
                disabled={generating}
                style={{ paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: palette.primary, borderWidth: 1, borderColor: palette.primary }}
              >
                {generating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Generate Outfits</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
