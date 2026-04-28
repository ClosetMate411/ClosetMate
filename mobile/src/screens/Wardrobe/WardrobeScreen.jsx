import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, Image as RNImage } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';

import useWardrobeStore from '../../store/wardrobeStore';
import useAuthStore from '../../store/authStore';
import apiService from '../../services/api.service';
import LoadingOverlay from './components/LoadingOverlay';
import ProcessingError from './components/ProcessingError';
import ClothingGrid from './components/ClothingGrid';

import ImageConfirmation from './components/ImageConfirmation';
import EmptyWardrobe from './components/EmptyWardrobe';
import { palette } from '../../theme/colors';

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const PROCESS_TIMEOUT_MS = 90000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;
const MAX_IMAGE_DIMENSION = 4000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif']);
const UNSUPPORTED_FORMAT_MESSAGE = 'Unsupported file format. Please upload a JPEG, PNG, or HEIC image.';

const extractProcessedUrl = (result) =>
  result?.data?.processed_url ||
  result?.processed_url ||
  result?.image_url ||
  result?.processed_image_url ||
  null;

export default function WardrobeScreen() {
  const items = useWardrobeStore((s) => s.items);
  const loading = useWardrobeStore((s) => s.loading);
  const fetchItems = useWardrobeStore((s) => s.fetchItems);
  const addItem = useWardrobeStore((s) => s.addItem);
  const updateItem = useWardrobeStore((s) => s.updateItem);
  const removeItem = useWardrobeStore((s) => s.removeItem);
  const setAiLabels = useWardrobeStore((s) => s.setAiLabels);
  const aiLabels = useWardrobeStore((s) => s.aiLabels);
  const rawUser = useAuthStore((s) => s.user);
  const authUser = rawUser?.user && typeof rawUser.user === 'object' ? rawUser.user : rawUser;

  const [uploadState, setUploadState] = useState('idle'); // idle|processing|saving|updating|deleting|error|confirming
  const [pickedAsset, setPickedAsset] = useState(null); // ImagePicker asset
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processingError, setProcessingError] = useState('');
  const [showUploadInterface, setShowUploadInterface] = useState(false);
  const [uploadValidationError, setUploadValidationError] = useState('');
  const [wardrobeStats, setWardrobeStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);


  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const abortControllerRef = useRef(null);
  const displayName = useMemo(
    () => authUser?.full_name || authUser?.fullName || authUser?.name || authUser?.username || 'Your',
    [authUser]
  );
  const totalPieces = wardrobeStats?.total_items ?? items.length ?? 0;

  const fetchWardrobeStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiService.getWardrobeStats();
      setWardrobeStats(res?.data || null);
    } catch {
      setWardrobeStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchItems({ force: true });
        await fetchWardrobeStats();
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to load wardrobe');
      }
    })();
  }, [fetchItems, fetchWardrobeStats]);

  useFocusEffect(
    useCallback(() => {
      setShowUploadInterface(false);
      setUploadValidationError('');
      return undefined;
    }, [])
  );

  // Load AI labels from outfits if not already loaded
  useEffect(() => {
    if (Object.keys(aiLabels).length > 0) return;
    (async () => {
      try {
        const res = await apiService.getOutfits();
        const list = Array.isArray(res?.data) ? res.data : [];
        const labels = {};
        const detailPromises = list.map(async (outfit) => {
          if (outfit?.items && outfit.items.length > 0) return outfit;
          if (!outfit?.id) return outfit;
          try {
            const detail = await apiService.getOutfit(outfit.id);
            return detail?.data || outfit;
          } catch { return outfit; }
        });
        const detailedOutfits = await Promise.all(detailPromises);
        for (const outfit of detailedOutfits) {
          const outfitItems = Array.isArray(outfit?.items) ? outfit.items : [];
          for (const item of outfitItems) {
            const id = item?.item_id || item?.id || item?._id || item?.wardrobe_item_id;
            const name = item?.name || item?.item_name;
            if (id && name && name.trim()) labels[String(id)] = name.trim();
          }
        }
        if (Object.keys(labels).length > 0) setAiLabels(labels);
      } catch { }
    })();
  }, [aiLabels, setAiLabels]);

  const currentSelectedItem = useMemo(() => {
    if (!selectedItem) return null;
    const inStore = items.find((it) => it.id === selectedItem.id);
    return inStore ? { ...inStore, ...selectedItem } : selectedItem;
  }, [items, selectedItem]);

  const clearUploadFlow = () => {
    setUploadState('idle');
    setPickedAsset(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
    setProcessingError('');
    abortControllerRef.current = null;
  };

  const toUploadFile = (asset) => ({
    uri: asset.uri,
    name: asset.fileName || `upload_${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  });

  const getImageDimensions = (uri) =>
    new Promise((resolve, reject) => {
      RNImage.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });

  const getFileSize = async (asset) => {
    if (typeof asset?.fileSize === 'number' && asset.fileSize > 0) return asset.fileSize;
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    return blob.size;
  };

  const validateSelectedAsset = async (asset) => {
    const ext = (asset?.fileName || asset?.uri || '')
      .split('.')
      .pop()
      ?.toLowerCase();
    const mime = (asset?.mimeType || '').toLowerCase();
    const formatAllowed = ALLOWED_MIME_TYPES.has(mime) || (ext && ALLOWED_EXTENSIONS.has(ext));
    if (!formatAllowed) return UNSUPPORTED_FORMAT_MESSAGE;

    const fileSize = await getFileSize(asset);
    if (fileSize > MAX_FILE_SIZE_BYTES) return 'File size exceeds 10 MB. Please upload a file up to 10 MB.';

    let width = asset?.width;
    let height = asset?.height;
    if (!width || !height) {
      const dims = await getImageDimensions(asset.uri);
      width = dims.width;
      height = dims.height;
    }

    if (
      width < MIN_IMAGE_DIMENSION ||
      height < MIN_IMAGE_DIMENSION ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION
    ) {
      return 'Image dimensions must be between 200x200 and 4000x4000 pixels.';
    }

    return null;
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearUploadFlow();
    setShowUploadInterface(false);
    setUploadValidationError('');
    Alert.alert('Upload cancelled.');
  };

  const openUploadInterface = () => {
    setUploadValidationError('');
    setShowUploadInterface(true);
  };

  const processPickedAsset = async (asset) => {
    setPickedAsset(asset);
    setUploadState('processing');
    setRetryCount(0);
    setProcessingError('');

    try {
      const file = toUploadFile(asset);
      abortControllerRef.current = new AbortController();

      const result = await withTimeout(
        apiService.processImage(file, abortControllerRef.current.signal),
        PROCESS_TIMEOUT_MS,
        'Image processing timed out. Please try again.'
      );
      const imageUrl = extractProcessedUrl(result);

      if (!imageUrl) throw new Error('No image URL in response');

      setProcessedImageUrl(imageUrl);
      setUploadState('confirming');
    } catch (e) {
      if (e?.message === 'Upload cancelled.') {
        clearUploadFlow();
        setShowUploadInterface(false);
        Alert.alert('Upload cancelled.');
        return;
      }
      setProcessingError(e?.message || 'Failed to process image.');
      setUploadState('error');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Media library permission is required.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (res.canceled) return;

    const asset = res.assets[0];
    try {
      const validationError = await validateSelectedAsset(asset);
      if (validationError) {
        setUploadValidationError(validationError);
        setShowUploadInterface(true);
        return;
      }
    } catch {
      setUploadValidationError('Could not validate the selected image. Please choose another image.');
      setShowUploadInterface(true);
      return;
    }

    setUploadValidationError('');
    setShowUploadInterface(false);
    await processPickedAsset(asset);
  };

  const retryProcessing = async () => {
    if (!pickedAsset || retryCount >= 2) return;
    setUploadState('processing');
    setRetryCount((prev) => prev + 1);
    setProcessingError('');
    try {
      abortControllerRef.current = new AbortController();
      const result = await withTimeout(
        apiService.processImage(toUploadFile(pickedAsset), abortControllerRef.current.signal),
        PROCESS_TIMEOUT_MS,
        'Image processing timed out. Please try again.'
      );
      const imageUrl = extractProcessedUrl(result);
      if (!imageUrl) throw new Error('No image URL in response');
      setProcessedImageUrl(imageUrl);
      setUploadState('confirming');
    } catch (e) {
      if (e?.message === 'Upload cancelled.') {
        clearUploadFlow();
        setShowUploadInterface(false);
        Alert.alert('Upload cancelled.');
        return;
      }
      setProcessingError(e?.message || 'Failed to process image.');
      setUploadState('error');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const confirmProcessed = async () => {
    setUploadState('idle');
    await saveItem();
  };

  const saveItem = async () => {
    if (!pickedAsset) return;

    setUploadState('saving');

    try {
      const file = toUploadFile(pickedAsset);

      await addItem(file, '', '');
      await fetchWardrobeStats();
      if (processedImageUrl) {
        setSelectedItem((prev) => (prev ? { ...prev, image: processedImageUrl } : prev));
      }

      clearUploadFlow();

      Alert.alert('Saved', 'Item saved successfully! AI will generate a name automatically.');
    } catch (e) {
      clearUploadFlow();
      Alert.alert('Save failed', e.message || 'Failed to save item');
    }
  };

  const deleteItem = async (id) => {
    Alert.alert('Delete', 'Delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploadState('deleting');
            await removeItem(id);
            await fetchWardrobeStats();
            if (selectedItem?.id === id) {
              setSelectedItem(null);
              setIsEditingItem(false);
            }
            setUploadState('idle');
          } catch (e) {
            setUploadState('idle');
            Alert.alert('Delete failed', e.message || 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleSaveEdit = async (id, updates) => {
    setUploadState('updating');
    try {
      await updateItem(id, updates);
      setUploadState('idle');
      Alert.alert('Updated', 'Item updated successfully!');
    } catch (e) {
      setUploadState('idle');
      Alert.alert('Update failed', e.message || 'Failed to update item');
    }
  };

  const handleCardClick = (item) => {
    setSelectedItem(item);
    setIsEditingItem(false);
  };

  const handleBack = () => {
    setSelectedItem(null);
    setIsEditingItem(false);
  };

  const handleDeleteSelected = () => {
    if (currentSelectedItem?.id) deleteItem(currentSelectedItem.id);
  };

  const handleProcessEditImage = async (file, tempEdits) => {
    if (!selectedItem) return;
    if (tempEdits) {
      setSelectedItem((prev) => ({ ...prev, name: tempEdits.name, weather: tempEdits.weather }));
    }
    setUploadState('processing');
    try {
      const result = await withTimeout(
        apiService.processImage(file),
        PROCESS_TIMEOUT_MS,
        'Image processing timed out. Please try again.'
      );
      const imageUrl = extractProcessedUrl(result);
      if (!imageUrl) throw new Error('No image URL in response');
      setSelectedItem((prev) => ({ ...prev, image: imageUrl, processedFile: file }));
      setProcessedImageUrl(imageUrl);
      setUploadState('idle');
      setIsEditingItem(true);
      Alert.alert('Success', 'Background has been successfully removed');
    } catch (error) {
      setUploadState('idle');
      Alert.alert('Processing failed', error.message || 'Failed to process image.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 10, backgroundColor: palette.background }}>
      <LinearGradient
        colors={['#22163b', '#2a1d44', '#241837']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 22,
          paddingVertical: 20,
          paddingHorizontal: 16,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: -20, top: 30, width: 180, height: 120, borderRadius: 90, backgroundColor: 'rgba(139,92,246,0.22)' }} />
        <View style={{ position: 'absolute', right: -20, top: 12, width: 140, height: 100, borderRadius: 70, backgroundColor: 'rgba(124,58,237,0.25)' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: '#d8ccff', fontSize: 28, lineHeight: 32, fontWeight: '800' }}>
              {displayName}'s
            </Text>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '800' }}>
              Wardrobe
            </Text>
            <Text style={{ color: 'rgba(216,204,255,0.85)', fontSize: 15, marginTop: 6, fontWeight: '700' }}>
              {statsLoading ? 'Loading pieces...' : `${totalPieces} pieces`}
            </Text>
            <Text style={{ color: 'rgba(216,204,255,0.45)', fontSize: 10, marginTop: 18, fontWeight: '700', letterSpacing: 0.8 }}>
              CLICK ANY ITEM TO VIEW OR EDIT IT
            </Text>
          </View>
          <Pressable
            onPress={openUploadInterface}
            style={{
              borderRadius: 24,
              backgroundColor: '#8b5cf6',
              paddingHorizontal: 18,
              paddingVertical: 12,
              shadowColor: '#8b5cf6',
              shadowOpacity: 0.45,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 7,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>+ Add Item</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {showUploadInterface ? (
        <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 14, gap: 10, backgroundColor: palette.surface }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Add Clothing Item</Text>
          <Text style={{ color: palette.textMuted }}>Accepted formats: JPEG, PNG, HEIC (Max 10 MB).</Text>
          {uploadValidationError ? (
            <Text style={{ color: palette.danger }}>{uploadValidationError}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={pickImage} style={{ flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Choose File</Text>
            </Pressable>
            <Pressable onPress={cancelUpload} style={{ flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
              <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel Upload</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <LoadingOverlay uploadState={uploadState} loading={loading} onCancelUpload={cancelUpload} />

      {uploadState === 'error' ? (
        <ProcessingError
          retryCount={retryCount}
          errorMessage={processingError}
          onRetry={retryProcessing}
          onUploadDifferent={openUploadInterface}
          onReturn={clearUploadFlow}
        />
      ) : null}

      {uploadState === 'confirming' && processedImageUrl ? (
        <ImageConfirmation
          imageUrl={processedImageUrl}
          onConfirm={confirmProcessed}
          onUploadDifferent={openUploadInterface}
          onCancel={clearUploadFlow}
          isEditMode={!!(selectedItem && selectedItem.id)}
        />
      ) : null}

      {!items.length ? (
        <EmptyWardrobe onAddClick={openUploadInterface} />
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          <ClothingGrid
            items={items}
            selectedItem={currentSelectedItem}
            onCardClick={handleCardClick}
            onBack={handleBack}
            onSave={handleSaveEdit}
            onDelete={handleDeleteSelected}
            onProcessImage={handleProcessEditImage}
            isEditingItem={isEditingItem}
            onEditToggle={setIsEditingItem}
          />
        </View>
      )}



    </View>
  );
}
