import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, Alert, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ConfirmModal from './ConfirmModal';
import { palette } from '../../../theme/colors';
import useWardrobeStore from '../../../store/wardrobeStore';
import { generateItemLabel } from '../../../utils/helpers';

const DEFAULT_ITEM_NAME = '';
const formatWeather = (value) =>
  String(value || '')
    .trim()
    .replace(/[_-]+/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('/');

function ClothingDetail({ item, onBack, onSave, onDelete, onProcessImage, isEditingItem, onEditToggle }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;
  const aiLabels = useWardrobeStore((s) => s.aiLabels);
  const aiName = aiLabels[String(item?.id || '')] || '';
  const generatedLabel = generateItemLabel(item);
  const resolvedName = aiName || generatedLabel || item?.name || '';
  const displayName = resolvedName.trim().toLowerCase() === 'untitled' ? '' : resolvedName;
  const weatherValue = formatWeather(item?.weather || item?.season || '');
  const [isEditing, setIsEditing] = useState(!!isEditingItem);
  const [editState, setEditState] = useState({
    name: resolvedName || DEFAULT_ITEM_NAME,
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(item?.image || item?.image_url || null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmVariant, setConfirmVariant] = useState('delete');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(() => () => {});

  useEffect(() => {
    setEditState({
      name: resolvedName || DEFAULT_ITEM_NAME,
      image: null,
    });
    setPreviewImage(item?.image || item?.image_url || null);
    setIsEditing(!!isEditingItem);
  }, [item, isEditingItem, resolvedName]);

  const normalize = (v, fallback) => (v === fallback || !v ? '' : v);

  const hasChanges = useMemo(() => {
    if (!isEditing) return false;
    const originalName = normalize(item?.name, DEFAULT_ITEM_NAME).trim();
    const editedName = normalize(editState.name, DEFAULT_ITEM_NAME).trim();
    return originalName !== editedName || !!editState.image;
  }, [isEditing, item, editState]);

  const handleEdit = () => {
    setIsEditing(true);
    onEditToggle?.(true);
  };

  const handleImagePick = async () => {
    if (!isEditing) return;
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
    const file = {
      uri: asset.uri,
      name: asset.fileName || `upload_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };
    setPreviewImage(asset.uri);
    setEditState((prev) => ({ ...prev, image: file }));
    if (onProcessImage) {
      await onProcessImage(file, { name: editState.name });
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setConfirmVariant('unsaved');
      setConfirmTitle('Unsaved Changes');
      setConfirmMessage('Discard your changes?');
      setConfirmAction(() => () => {
        setIsEditing(false);
        onEditToggle?.(false);
        setEditState({
          name: item?.name || DEFAULT_ITEM_NAME,
          image: null,
        });
        setPreviewImage(item?.image || item?.image_url || null);
      });
      setConfirmOpen(true);
      return;
    }
    setIsEditing(false);
    onEditToggle?.(false);
  };

  const handleSave = () => {
    const updates = {};
    if (editState.image) updates.file = editState.image;
    setConfirmVariant('save');
    setConfirmTitle('Save Changes');
    setConfirmMessage('Do you want to save these changes?');
    setConfirmAction(() => () => {
      onSave(item.id, updates);
      setIsEditing(false);
      onEditToggle?.(false);
      onBack();
    });
    setConfirmOpen(true);
  };

  const handleBack = () => {
    if (isEditing && hasChanges) {
      setConfirmVariant('unsaved');
      setConfirmTitle('Unsaved Changes');
      setConfirmMessage('Go back and discard changes?');
      setConfirmAction(() => onBack);
      setConfirmOpen(true);
      return;
    }
    onBack();
  };

  return (
    <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, gap: 10, backgroundColor: palette.surface }}>
      <Pressable onPress={handleImagePick} disabled={!isEditing}>
        <View
          style={{
            width: '100%',
            height: isNarrow ? 240 : 280,
            borderRadius: 12,
            backgroundColor: palette.surfaceSoft,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {previewImage ? (
            <Image
              source={{ uri: previewImage }}
              resizeMode="contain"
              style={{ width: '92%', height: '92%' }}
            />
          ) : null}
        </View>
      </Pressable>

      <View style={{ gap: 8 }}>
        <Text style={{ color: '#6b7280', fontSize: isNarrow ? 14 : 16, fontWeight: '500' }}>Item Name</Text>
        <Text
          numberOfLines={2}
          style={{ color: '#7c3aed', fontSize: isNarrow ? 24 : 30, lineHeight: isNarrow ? 30 : 36, fontWeight: '800' }}
        >
          {displayName || 'AI will generate a name'}
        </Text>
      </View>

      {weatherValue ? (
        <>
          <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#6b7280', fontSize: isNarrow ? 16 : 18, fontWeight: '500' }}>Weather</Text>
            <Text
              numberOfLines={1}
              style={{ color: palette.text, fontSize: isNarrow ? 16 : 18, fontWeight: '700', textAlign: 'right', marginLeft: 12, flexShrink: 1 }}
            >
              {weatherValue}
            </Text>
          </View>
        </>
      ) : null}

      {!weatherValue ? (
        <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 6 }} />
      ) : null}

      {!isEditing ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Pressable onPress={handleBack} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
            <Text style={{ color: palette.text }}>Back</Text>
          </Pressable>
          <Pressable onPress={handleEdit} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setConfirmVariant('delete');
              setConfirmTitle('Delete Item');
              setConfirmMessage('Are you sure you want to delete this item?');
              setConfirmAction(() => onDelete);
              setConfirmOpen(true);
            }}
            style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.danger, backgroundColor: palette.dangerSoft }}
          >
            <Text style={{ color: palette.danger, fontWeight: '700' }}>Delete</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Pressable onPress={handleCancel} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
            <Text style={{ color: palette.text }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>
      )}

      <ConfirmModal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
        variant={confirmVariant}
      />
    </View>
  );
}

export default memo(ClothingDetail);
