import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView, Modal, Image, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/api.service';
import useWardrobeStore from '../../store/wardrobeStore';
import { palette } from '../../theme/colors';
import { radius, shadow, spacing, type } from '../../theme/tokens';

const OCCASION_OPTIONS = [
  { label: 'Everyday', value: 'everyday' },
  { label: 'Work', value: 'work' },
  { label: 'Formal Event', value: 'formal-event' },
  { label: 'Date Night', value: 'date-night' },
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
  { label: 'Business Casual', value: 'business-casual' },
  { label: 'Smart Casual', value: 'smart-casual' },
  { label: 'Sporty', value: 'sporty' },
  { label: 'Streetwear', value: 'streetwear' },
  { label: 'Bohemian', value: 'bohemian' },
  { label: 'Minimalist', value: 'minimalist' },
  { label: 'Preppy', value: 'preppy' },
  { label: 'Vintage', value: 'vintage' },
  { label: 'Classic', value: 'classic' },
  { label: 'Athleisure', value: 'athleisure' },
];

const SEASON_OPTIONS = [
  { label: 'All Seasons', value: 'all' },
  { label: 'Spring', value: 'spring' },
  { label: 'Summer', value: 'summer' },
  { label: 'Fall', value: 'fall' },
  { label: 'Winter', value: 'winter' },
];

const getItemImage = (item) =>
  item?.image ||
  item?.image_url ||
  item?.processed_image_url ||
  item?.processedImageUrl ||
  null;

const getItemName = (item, idx) => item?.name || item?.item_name || `Item ${idx + 1}`;

const getItemIdentifier = (item) => item?.item_id || item?.id || item?._id || item?.wardrobe_item_id || null;
const normalizeGeneratorValue = (value) => String(value || '').trim().toLowerCase().replace(/_/g, '-');
const formatTag = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export default function OutfitsScreen() {
  const wardrobeItems = useWardrobeStore((s) => s.items);
  const fetchWardrobeItems = useWardrobeStore((s) => s.fetchItems);
  const setAiLabels = useWardrobeStore((s) => s.setAiLabels);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [generatedOutfits, setGeneratedOutfits] = useState([]);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [curatedIndex, setCuratedIndex] = useState(0);
  const [savingCurated, setSavingCurated] = useState(false);
  const [savedCuratedMap, setSavedCuratedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [deletingOutfit, setDeletingOutfit] = useState(false);
  const [generatedFavorites, setGeneratedFavorites] = useState({});
  const [generateConfigOpen, setGenerateConfigOpen] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState('everyday');
  const [selectedStyle, setSelectedStyle] = useState('any');
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [selectedCount, setSelectedCount] = useState(3);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 860;

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
        season: selectedSeason,
        occasion: normalizeGeneratorValue(selectedOccasion),
        style: normalizeGeneratorValue(selectedStyle),
      });
      const generatedRaw = Array.isArray(res?.data?.outfits) ? res.data.outfits : [];
      const generated = generatedRaw.map(normalizeOutfitForDetail);
      setGeneratedOutfits(generated);
      extractAiLabels(generated);
      setSavedCuratedMap({});
      setCuratedIndex(0);
      setGenerateConfigOpen(false);
      setSeasonOpen(false);
      setOccasionOpen(false);
      setStyleOpen(false);
      if (generated.length > 0) {
        setCuratedOpen(true);
      } else {
        Alert.alert('No outfits', 'No outfit generated for selected filters.');
      }
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

  const getGeneratedOutfitKey = useCallback((outfit, index) => outfit?.id || outfit?.name || `${index}`, []);

  const toSavePayload = useCallback((outfit) => {
    const itemIds = Array.isArray(outfit?.item_ids)
      ? outfit.item_ids
      : (Array.isArray(outfit?.items)
        ? outfit.items
          .map((item) => String(getItemIdentifier(item) || ''))
          .filter(Boolean)
        : []);

    return {
      name: (outfit?.name || `Outfit ${Date.now()}`).slice(0, 100),
      item_ids: itemIds,
      style: outfit?.style || undefined,
      occasion: outfit?.occasion || undefined,
      season: outfit?.season || undefined,
      cohesion_score: outfit?.cohesion_score || undefined,
      reasoning: outfit?.reasoning || undefined,
    };
  }, []);

  const getOutfitItemIds = useCallback((outfit) => (
    Array.isArray(outfit?.item_ids)
      ? outfit.item_ids.map((id) => String(id)).filter(Boolean)
      : (Array.isArray(outfit?.items)
        ? outfit.items.map((item) => String(getItemIdentifier(item) || '')).filter(Boolean)
        : [])
  ), []);

  const getOutfitSignature = useCallback((outfit) => JSON.stringify(getOutfitItemIds(outfit)), [getOutfitItemIds]);

  const handleSaveGeneratedOutfit = useCallback(async () => {
    if (!selectedOutfit || savingOutfit) return;
    if (selectedOutfit?.id) return;

    const payload = toSavePayload(selectedOutfit);
    if (!Array.isArray(payload.item_ids) || payload.item_ids.length < 2) {
      Alert.alert('Save failed', 'An outfit must contain at least 2 items.');
      return;
    }

    setSavingOutfit(true);
    try {
      const response = await apiService.saveOutfit(payload);
      const saved = response?.data || response;
      if (saved) {
        setSavedOutfits((prev) => [saved, ...prev]);
      }
      const selectedSignature = JSON.stringify(payload.item_ids);
      setGeneratedOutfits((prev) => {
        const next = [...prev];
        const idx = next.findIndex((entry) => {
          const entryIds = Array.isArray(entry?.item_ids)
            ? entry.item_ids
            : (Array.isArray(entry?.items)
              ? entry.items.map((item) => String(getItemIdentifier(item) || '')).filter(Boolean)
              : []);
          return JSON.stringify(entryIds) === selectedSignature;
        });
        if (idx > -1) next.splice(idx, 1);
        return next;
      });
      setDetailOpen(false);
      setSelectedOutfit(null);
      Alert.alert('Saved', 'Outfit saved to your collection.');
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save outfit');
    } finally {
      setSavingOutfit(false);
    }
  }, [selectedOutfit, savingOutfit, toSavePayload]);

  const handleSaveCuratedOutfit = useCallback(async () => {
    const outfit = generatedOutfits[curatedIndex];
    if (!outfit || savingCurated) return;
    const signature = getOutfitSignature(outfit);
    if (savedCuratedMap[signature]) return;

    const payload = toSavePayload(outfit);
    if (!Array.isArray(payload.item_ids) || payload.item_ids.length < 2) {
      Alert.alert('Save failed', 'An outfit must contain at least 2 items.');
      return;
    }

    setSavingCurated(true);
    try {
      const response = await apiService.saveOutfit(payload);
      const saved = response?.data || response;
      if (saved) {
        setSavedOutfits((prev) => [saved, ...prev]);
      }
      setSavedCuratedMap((prev) => ({ ...prev, [signature]: true }));
      Alert.alert('Saved', 'Outfit saved to your collection.');
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save outfit');
    } finally {
      setSavingCurated(false);
    }
  }, [curatedIndex, generatedOutfits, getOutfitSignature, savedCuratedMap, savingCurated, toSavePayload]);

  const allOutfits = useMemo(() => {
    const combined = [...savedOutfits];
    return combined.sort((a, b) => {
      const aFav = a?.id
        ? !!(a?.is_favorite || a?.isFavorite || a?.favorite)
        : !!generatedFavorites[getGeneratedOutfitKey(a, combined.indexOf(a))];
      const bFav = b?.id
        ? !!(b?.is_favorite || b?.isFavorite || b?.favorite)
        : !!generatedFavorites[getGeneratedOutfitKey(b, combined.indexOf(b))];
      return (bFav ? 1 : 0) - (aFav ? 1 : 0);
    });
  }, [savedOutfits, generatedFavorites, getGeneratedOutfitKey]);
  const selectedSeasonLabel = SEASON_OPTIONS.find((option) => option.value === selectedSeason)?.label || 'All Seasons';
  const selectedOccasionLabel = OCCASION_OPTIONS.find((option) => option.value === selectedOccasion)?.label || 'Everyday';
  const selectedStyleLabel = STYLE_OPTIONS.find((option) => option.value === selectedStyle)?.label || 'Any Style';
  const currentCuratedOutfit = generatedOutfits[curatedIndex] || null;
  const currentCuratedSignature = currentCuratedOutfit ? getOutfitSignature(currentCuratedOutfit) : '';
  const currentCuratedSaved = !!savedCuratedMap[currentCuratedSignature];

  const isFavoriteOutfit = useCallback((outfit, index) => {
    if (!outfit) return false;
    if (outfit?.id) {
      return !!(outfit?.is_favorite || outfit?.isFavorite || outfit?.favorite);
    }
    return !!generatedFavorites[getGeneratedOutfitKey(outfit, index)];
  }, [generatedFavorites, getGeneratedOutfitKey]);

  const getOutfitPreviewItems = useCallback((outfit) => {
    if (Array.isArray(outfit?.items) && outfit.items.length > 0) {
      return outfit.items.slice(0, 4).map((item, idx) => ({
        id: getItemIdentifier(item) || `${idx}`,
        image: getItemImage(item),
        name: getItemName(item, idx),
      }));
    }
    const ids = Array.isArray(outfit?.item_ids) ? outfit.item_ids.slice(0, 4) : [];
    return ids.map((id, idx) => {
      const mapped = wardrobeItemMap.get(String(id));
      return {
        id: String(id || idx),
        image: getItemImage(mapped),
        name: getItemName(mapped, idx),
      };
    });
  }, [wardrobeItemMap]);

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

  const handleDeleteSavedOutfit = useCallback(() => {
    const targetId = selectedOutfit?.id;
    if (!targetId || deletingOutfit) return;

    Alert.alert(
      'Delete Outfit',
      `Are you sure you want to delete "${selectedOutfit?.name || 'this outfit'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingOutfit(true);
              await apiService.deleteOutfit(targetId);
              setSavedOutfits((prev) => prev.filter((entry) => String(entry?.id) !== String(targetId)));
              setDetailOpen(false);
              setSelectedOutfit(null);
              Alert.alert('Deleted', 'Outfit deleted successfully.');
            } catch (e) {
              Alert.alert('Delete failed', e.message || 'Could not delete outfit.');
            } finally {
              setDeletingOutfit(false);
            }
          },
        },
      ]
    );
  }, [selectedOutfit, deletingOutfit]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...type.hero, color: palette.text }}>Your Outfits</Text>
        <Text style={{ ...type.label, color: palette.textMuted }}>{allOutfits.length} combinations</Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator size="small" color={palette.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <Pressable
              onPress={() => setGenerateConfigOpen(true)}
              style={{
                width: isCompact ? '100%' : '48%',
                minHeight: isCompact ? 180 : 300,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#cab6ff',
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f5ff',
                marginBottom: 6,
              }}
            >
              <Ionicons name="add" size={isCompact ? 40 : 50} color="#b7a0f8" />
              <Text style={{ marginTop: 10, fontSize: isCompact ? 16 : 17, color: palette.textMuted, fontWeight: '500', textAlign: 'center' }}>
                {generating ? 'Generating...' : 'Generate New Outfit'}
              </Text>
            </Pressable>

            {allOutfits.map((outfit, index) => {
              const previewItems = getOutfitPreviewItems(outfit);
              const hiddenCount = Math.max(0, (outfit?.item_ids?.length || outfit?.items?.length || 0) - 4);
              const isFav = isFavoriteOutfit(outfit, index);
              const tags = [outfit?.style, outfit?.occasion].filter(Boolean).slice(0, 2).map(formatTag);
              return (
                <Pressable
                  key={outfit?.id || `${outfit?.name || 'outfit'}-${index}`}
                  onPress={() => openOutfitDetail(outfit)}
                  style={{
                    width: isCompact ? '100%' : '48%',
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: radius.lg,
                    padding: spacing.sm,
                    backgroundColor: palette.surfaceElevated,
                    marginBottom: 6,
                    ...shadow.soft,
                  }}
                >
                  <View style={{ position: 'relative', borderRadius: radius.md, overflow: 'hidden', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                      {[0, 1, 2, 3].map((cell) => {
                        const item = previewItems[cell];
                        return (
                          <View
                            key={cell}
                            style={{
                              width: '49.5%',
                              aspectRatio: 1,
                              backgroundColor: palette.surfaceSoft,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item?.image ? (
                              <Image source={{ uri: item.image }} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    {hiddenCount > 0 ? (
                      <View style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 8,
                        backgroundColor: 'rgba(24,24,27,0.6)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                      }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>+{hiddenCount}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <Text numberOfLines={2} style={{ flex: 1, fontSize: isCompact ? 17 : 18, fontWeight: '800', color: palette.text }}>
                      {outfit?.name || `Outfit ${index + 1}`}
                    </Text>
                    <Pressable onPress={() => toggleFavorite(outfit, index)} hitSlop={8} style={{ padding: 2 }}>
                      <Ionicons
                        name={isFav ? 'star' : 'star-outline'}
                        size={22}
                        color={isFav ? '#f59e0b' : '#9ca3af'}
                      />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {tags.map((tag) => (
                      <View key={`${outfit?.id || index}-${tag}`} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ecf9', borderWidth: 1, borderColor: '#e5ddfb' }}>
                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600' }}>{String(tag)}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 10 }}>
                    Cohesion: <Text style={{ color: '#16a34a', fontWeight: '800' }}>{(outfit?.cohesion_score ?? '-')}/10</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {detailLoading ? (
        <View style={{ position: 'absolute', right: 16, top: 16, backgroundColor: palette.surfaceElevated, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, ...shadow.soft }}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={{ color: palette.text }}>Loading details...</Text>
        </View>
      ) : null}

      <Modal visible={detailOpen} transparent animationType="fade" onRequestClose={() => setDetailOpen(false)}>
        <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
          <View style={{ width: '100%', maxHeight: '92%', backgroundColor: palette.surfaceElevated, borderRadius: radius.lg, padding: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, flex: 1 }}>
                {selectedOutfit?.name || 'Outfit'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {selectedOutfit?.id ? (
                  <Pressable
                    onPress={handleDeleteSavedOutfit}
                    disabled={deletingOutfit}
                    style={{ padding: 6, opacity: deletingOutfit ? 0.6 : 1 }}
                  >
                    {deletingOutfit ? (
                      <ActivityIndicator size="small" color={palette.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={22} color={palette.danger} />
                    )}
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setDetailOpen(false)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={24} color={palette.textMuted} />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: palette.textMuted, marginBottom: 8 }}>
                {selectedOutfit?.item_ids?.length || selectedOutfit?.items?.length || 0} items
              </Text>

              {selectedOutfit?.reasoning ? (
                <Text style={{ color: palette.text, marginBottom: 10 }}>
                  {selectedOutfit.reasoning}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {selectedOutfit?.style ? <Text style={{ color: palette.textMuted }}>Style: {selectedOutfit.style}</Text> : null}
                {selectedOutfit?.occasion ? <Text style={{ color: palette.textMuted }}>Occasion: {selectedOutfit.occasion}</Text> : null}
                {selectedOutfit?.season ? <Text style={{ color: palette.textMuted }}>Season: {selectedOutfit.season}</Text> : null}
                {selectedOutfit?.cohesion_score ? <Text style={{ color: palette.textMuted }}>Score: {selectedOutfit.cohesion_score}/10</Text> : null}
              </View>

              {!selectedOutfit?.id ? (
                <Pressable
                  onPress={handleSaveGeneratedOutfit}
                  disabled={savingOutfit}
                  style={{
                    marginBottom: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: palette.primary,
                    backgroundColor: savingOutfit ? palette.primarySoft : palette.primary,
                  }}
                >
                  <Text style={{ color: savingOutfit ? palette.primaryStrong : '#fff', fontWeight: '700' }}>
                    {savingOutfit ? 'Saving...' : 'Save Outfit'}
                  </Text>
                </Pressable>
              ) : null}

              {Array.isArray(selectedOutfit?.items) && selectedOutfit.items.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }}>
                  {selectedOutfit.items.map((item, idx) => {
                    const image = getItemImage(item);
                    return (
                      <View
                        key={getItemIdentifier(item) || `${idx}`}
                        style={{
                          width: '31.5%',
                          borderWidth: 1,
                          borderColor: palette.border,
                          borderRadius: 14,
                          padding: 8,
                          backgroundColor: palette.surface,
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <View style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {image ? (
                            <Image source={{ uri: image }} style={{ width: '85%', height: '85%' }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="shirt-outline" size={26} color={palette.textMuted} />
                          )}
                        </View>
                        <Text numberOfLines={2} style={{ color: palette.text, fontWeight: '700', textAlign: 'center', fontSize: 12 }}>
                          {getItemName(item, idx)}
                        </Text>
                        <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 10, textAlign: 'center' }}>
                          {item?.category || ''}{item?.color_primary ? ` · ${item.color_primary}` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={curatedOpen} transparent animationType="fade" onRequestClose={() => setCuratedOpen(false)}>
        <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: palette.surface, borderRadius: 20, padding: 16, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Curated Outfits</Text>
              <Pressable onPress={() => setCuratedOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surfaceSoft, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable
                onPress={() => setCuratedIndex((prev) => Math.max(0, prev - 1))}
                disabled={curatedIndex === 0}
                style={{ paddingVertical: 2, opacity: curatedIndex === 0 ? 0.35 : 1 }}
              >
                <Text style={{ color: '#2485e6', fontSize: 17, fontWeight: '700' }}>{'< Previous'}</Text>
              </Pressable>
              <Text style={{ color: palette.text, fontSize: 17 }}>Outfit {generatedOutfits.length ? curatedIndex + 1 : 0} of {generatedOutfits.length}</Text>
              <Pressable
                onPress={() => setCuratedIndex((prev) => Math.min(generatedOutfits.length - 1, prev + 1))}
                disabled={curatedIndex >= generatedOutfits.length - 1}
                style={{ paddingVertical: 2, opacity: curatedIndex >= generatedOutfits.length - 1 ? 0.35 : 1 }}
              >
                <Text style={{ color: '#2485e6', fontSize: 17, fontWeight: '700' }}>{'Next >'}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
              <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: palette.surfaceSoft, padding: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
                  {(Array.isArray(currentCuratedOutfit?.items) ? currentCuratedOutfit.items : []).map((item, idx) => {
                    const image = getItemImage(item);
                    return (
                      <View key={getItemIdentifier(item) || `${idx}`} style={{ width: '30%', minWidth: 95, alignItems: 'center' }}>
                        <View style={{ width: '100%', aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                          {image ? (
                            <Image source={{ uri: image }} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="shirt-outline" size={26} color={palette.textMuted} />
                          )}
                        </View>
                        <Text numberOfLines={2} style={{ marginTop: 6, textAlign: 'center', color: palette.text, fontSize: 13, fontWeight: '500' }}>
                          {getItemName(item, idx)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: palette.text }}>
                  {currentCuratedOutfit?.name || `Outfit ${curatedIndex + 1}`}
                </Text>
                <View style={{ backgroundColor: '#e9f8ec', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ color: '#22a455', fontSize: 14, fontWeight: '800' }}>
                    COHESION: {currentCuratedOutfit?.cohesion_score ?? '-'}/10
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[currentCuratedOutfit?.occasion, currentCuratedOutfit?.season, currentCuratedOutfit?.style].filter(Boolean).map((tag, idx) => (
                  <View key={`${tag}-${idx}`} style={{ borderWidth: 1, borderColor: '#9ca3af', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' }}>{formatTag(tag)}</Text>
                  </View>
                ))}
              </View>

              {currentCuratedOutfit?.reasoning ? (
                <Text style={{ marginTop: 12, color: palette.textMuted, fontSize: 15, lineHeight: 22 }}>
                  {currentCuratedOutfit.reasoning}
                </Text>
              ) : null}
            </ScrollView>

            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setCuratedOpen(false)}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: palette.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: palette.surface,
                }}
              >
                <Text style={{ color: palette.text, fontSize: 17, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCuratedOutfit}
                disabled={savingCurated || currentCuratedSaved}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (savingCurated || currentCuratedSaved) ? palette.primarySoft : palette.primary,
                }}
              >
                <Text style={{ color: (savingCurated || currentCuratedSaved) ? palette.primaryStrong : '#fff', fontSize: 17, fontWeight: '800' }}>
                  {currentCuratedSaved ? 'Saved' : (savingCurated ? 'Saving...' : 'Save to Collection')}
                </Text>
              </Pressable>
            </View>
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
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 34, fontWeight: '500', color: palette.text }}>Outfit Preferences</Text>
                <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 22 }}>
                  Select your preferences and Gemini will curate the best combinations from your wardrobe.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Season/Weather</Text>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setSeasonOpen((prev) => !prev);
                      if (occasionOpen) setOccasionOpen(false);
                      if (styleOpen) setStyleOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '500', fontSize: 16 }}>{selectedSeasonLabel}</Text>
                    <Ionicons name={seasonOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {seasonOpen ? (
                    <View style={{ borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
                      {SEASON_OPTIONS.map((option, index) => {
                        const active = option.value === selectedSeason;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setSelectedSeason(option.value);
                              setSeasonOpen(false);
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
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Occasion</Text>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setOccasionOpen((prev) => !prev);
                      if (seasonOpen) setSeasonOpen(false);
                      if (styleOpen) setStyleOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '500', fontSize: 16 }}>{selectedOccasionLabel}</Text>
                    <Ionicons name={occasionOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {occasionOpen ? (
                    <View style={{ borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
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
                      if (seasonOpen) setSeasonOpen(false);
                      if (occasionOpen) setOccasionOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '500', fontSize: 16 }}>{selectedStyleLabel}</Text>
                    <Ionicons name={styleOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
                  </Pressable>

                  {styleOpen ? (
                    <View style={{ borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: 'hidden' }}>
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
                  <View
                    style={{
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: palette.borderStrong,
                      backgroundColor: palette.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => setSelectedCount((prev) => Math.max(1, prev - 1))}
                      style={{
                        width: 56,
                        height: 52,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRightWidth: 1,
                        borderRightColor: palette.borderStrong,
                      }}
                    >
                      <Ionicons name="remove" size={22} color={palette.text} />
                    </Pressable>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 18 }}>{selectedCount}</Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedCount((prev) => Math.min(10, prev + 1))}
                      style={{
                        width: 56,
                        height: 52,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeftWidth: 1,
                        borderLeftColor: palette.borderStrong,
                      }}
                    >
                      <Ionicons name="add" size={22} color={palette.text} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={{ marginTop: 18 }}>
              <Pressable
                onPress={handleGenerate}
                disabled={generating}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: palette.primary,
                  borderWidth: 1,
                  borderColor: palette.primary,
                  shadowColor: palette.primary,
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                }}
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
