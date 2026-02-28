import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/api.service';

export default function OutfitsScreen() {
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [generatedOutfits, setGeneratedOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOutfits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getOutfits();
      const list = Array.isArray(res?.data) ? res.data : [];
      setSavedOutfits(list);
    } catch (e) {
      setSavedOutfits([]);
      Alert.alert('Outfits', e.message || 'Failed to load outfits');
    } finally {
      setLoading(false);
    }
  }, []);

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
      const res = await apiService.generateOutfits({ count: 3, season: 'all', occasion: 'everyday', style: 'any' });
      const generated = Array.isArray(res?.data?.outfits) ? res.data.outfits : [];
      setGeneratedOutfits(generated);
      Alert.alert('Success', `New outfits generated (${generated.length}).`);
    } catch (e) {
      Alert.alert('Generate failed', e.message || 'Could not generate outfits');
    } finally {
      setGenerating(false);
    }
  };

  const openOutfitDetail = async (outfit) => {
    if (!outfit) return;

    // Generated outfits already include rich details.
    if (!outfit?.id || outfit?.items) {
      setSelectedOutfit(outfit);
      setDetailOpen(true);
      return;
    }

    // Saved outfits: fetch full detail by id.
    setDetailLoading(true);
    try {
      const res = await apiService.getOutfit(outfit.id);
      setSelectedOutfit(res?.data || outfit);
      setDetailOpen(true);
    } catch (e) {
      Alert.alert('Outfit detail', e.message || 'Could not load outfit details');
    } finally {
      setDetailLoading(false);
    }
  };

  const allOutfits = [...generatedOutfits, ...savedOutfits];

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
            onPress={handleGenerate}
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
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                {outfit?.name || `Outfit ${index + 1}`}
              </Text>
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
                <View style={{ gap: 8 }}>
                  {selectedOutfit.items.map((item, idx) => (
                    <View key={item?.item_id || item?.id || `${idx}`} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10 }}>
                      <Text style={{ fontWeight: '700', color: '#111827' }}>{item?.item_name || `Item ${idx + 1}`}</Text>
                      <Text style={{ color: '#6b7280' }}>
                        {item?.category || 'unknown'} / {item?.subcategory || 'unknown'} / {item?.color_primary || 'unknown'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
