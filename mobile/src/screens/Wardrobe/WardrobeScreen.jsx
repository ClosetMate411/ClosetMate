import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Alert, Image as RNImage } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';

import useWardrobeStore from '../../store/wardrobeStore';
import apiService from '../../services/api.service';
import LoadingOverlay from './components/LoadingOverlay';
import ProcessingError from './components/ProcessingError';
import ClothingGrid from './components/ClothingGrid';
import OptionalDetailsForm from './components/OptionalDetailsForm';
import ImageConfirmation from './components/ImageConfirmation';
import EmptyWardrobe from './components/EmptyWardrobe';
import { palette } from '../../theme/colors';

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const PROCESS_TIMEOUT_MS = 45000;
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

  const [uploadState, setUploadState] = useState('idle'); // idle|processing|saving|updating|deleting|error|confirming
  const [pickedAsset, setPickedAsset] = useState(null); // ImagePicker asset
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processingError, setProcessingError] = useState('');
  const [showUploadInterface, setShowUploadInterface] = useState(false);
  const [uploadValidationError, setUploadValidationError] = useState('');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { await fetchItems(); } catch (e) { Alert.alert('Error', e.message || 'Failed to load wardrobe'); }
    })();
  }, [fetchItems]);

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

  const useSampleImage = async () => {
    try {
      const sample = Asset.fromModule(require('../../../assets/images/Logo.png'));
      await sample.downloadAsync();
      const uri = sample.localUri || sample.uri;
      if (!uri) throw new Error('Sample image not available');

      await processPickedAsset({
        uri,
        fileName: 'sample-logo.png',
        mimeType: 'image/png',
      });
    } catch (e) {
      Alert.alert('Sample image failed', e?.message || 'Could not load sample image.');
    }
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

  const confirmProcessed = () => {
    setUploadState('idle');
    setDetailsOpen(true);
  };

  const saveItem = async (skipDetails = false, details) => {
    if (!pickedAsset) return;

    setDetailsOpen(false);
    setUploadState('saving');

    try {
      const file = toUploadFile(pickedAsset);
      const resolvedName = skipDetails ? '' : (details?.itemName ?? '');
      const resolvedSeason = skipDetails ? '' : (details?.weather ?? '');

      await addItem(file, resolvedName, resolvedSeason);
      if (processedImageUrl) {
        setSelectedItem((prev) => (prev ? { ...prev, image: processedImageUrl } : prev));
      }

      clearUploadFlow();

      Alert.alert('Saved', 'Item saved successfully!');
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text }}>Wardrobe</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={useSampleImage} style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, borderColor: palette.borderStrong, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.text }}>Sample</Text>
          </Pressable>
          <Pressable onPress={openUploadInterface} style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, borderColor: palette.primary, backgroundColor: palette.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
          </Pressable>
        </View>
      </View>

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
        <ClothingGrid
          items={items}
          onAddClick={openUploadInterface}
          selectedItem={currentSelectedItem}
          onCardClick={handleCardClick}
          onBack={handleBack}
          onSave={handleSaveEdit}
          onDelete={handleDeleteSelected}
          onProcessImage={handleProcessEditImage}
          isEditingItem={isEditingItem}
          onEditToggle={setIsEditingItem}
        />
      )}

      {/* Optional Details Modal */}
      <Modal visible={detailsOpen} transparent animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: palette.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: palette.surface, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text }}>Optional Details</Text>
            <OptionalDetailsForm
              onSave={(details) => saveItem(false, details)}
              onSkip={() => saveItem(true)}
            />

            <Pressable onPress={() => setDetailsOpen(false)} style={{ padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
              <Text style={{ color: palette.text }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}
