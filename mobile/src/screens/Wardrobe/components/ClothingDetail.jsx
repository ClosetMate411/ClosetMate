import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ConfirmModal from './ConfirmModal';
import { palette } from '../../../theme/colors';

const WEATHER_TYPES = ['Spring', 'Summer', 'Fall', 'Winter'];
const DEFAULT_ITEM_NAME = 'Untitled';
const DEFAULT_WEATHER = 'Untitled';

function ClothingDetail({ item, onBack, onSave, onDelete, onProcessImage, isEditingItem, onEditToggle }) {
  const [isEditing, setIsEditing] = useState(!!isEditingItem);
  const [editState, setEditState] = useState({
    name: item?.name || DEFAULT_ITEM_NAME,
    weather: item?.weather || '',
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(item?.image || item?.image_url || null);
  const [nameError, setNameError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmVariant, setConfirmVariant] = useState('delete');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(() => () => {});

  useEffect(() => {
    setEditState({
      name: item?.name || DEFAULT_ITEM_NAME,
      weather: item?.weather || '',
      image: null,
    });
    setPreviewImage(item?.image || item?.image_url || null);
    setIsEditing(!!isEditingItem);
  }, [item, isEditingItem]);

  const normalize = (v, fallback) => (v === fallback || !v ? '' : v);

  const hasChanges = useMemo(() => {
    if (!isEditing) return false;
    const originalName = normalize(item?.name, DEFAULT_ITEM_NAME).trim();
    const editedName = normalize(editState.name, DEFAULT_ITEM_NAME).trim();
    const originalWeather = normalize(item?.weather, DEFAULT_WEATHER).trim();
    const editedWeather = normalize(editState.weather, DEFAULT_WEATHER).trim();
    return originalName !== editedName || originalWeather !== editedWeather || !!editState.image;
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
      await onProcessImage(file, { name: editState.name, weather: editState.weather });
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
          weather: item?.weather || '',
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
    const trimmedName = (editState.name || '').trim();
    if (trimmedName.length > 100) {
      setNameError('Item name is too long (max 100 chars).');
      return;
    }
    const updates = {
      itemName: trimmedName || DEFAULT_ITEM_NAME,
      weather: editState.weather || DEFAULT_WEATHER,
    };
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
        {previewImage ? (
          <Image source={{ uri: previewImage }} style={{ width: '100%', height: 300, borderRadius: 12 }} />
        ) : (
          <View style={{ width: '100%', height: 300, borderRadius: 12, backgroundColor: palette.surfaceSoft }} />
        )}
      </Pressable>

      {!isEditing ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700', color: palette.text }}>Item Name</Text>
          <Text style={{ color: palette.textMuted }}>{item?.name || DEFAULT_ITEM_NAME}</Text>
          <Text style={{ fontWeight: '700', color: palette.text }}>Weather</Text>
          <Text style={{ color: palette.textMuted }}>{item?.weather || DEFAULT_WEATHER}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Item Name</Text>
          <TextInput
            value={editState.name}
            onChangeText={(v) => {
              setEditState((prev) => ({ ...prev, name: v }));
              if (nameError) setNameError('');
            }}
            style={{ borderWidth: 1, borderColor: nameError ? palette.danger : palette.borderStrong, borderRadius: 10, padding: 12, backgroundColor: palette.surface, color: palette.text }}
            placeholderTextColor={palette.textMuted}
          />
          {nameError ? <Text style={{ color: palette.danger }}>{nameError}</Text> : null}
          <Text style={{ color: palette.text, fontWeight: '600' }}>Weather</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WEATHER_TYPES.map((weather) => {
              const active = editState.weather === weather;
              return (
                <Pressable
                  key={weather}
                  onPress={() => setEditState((prev) => ({ ...prev, weather: prev.weather === weather ? '' : weather }))}
                  style={{ paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 999, borderColor: active ? palette.primary : palette.borderStrong, backgroundColor: active ? palette.primarySoft : palette.surface }}
                >
                  <Text style={{ color: palette.text }}>{weather}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {!isEditing ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
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
