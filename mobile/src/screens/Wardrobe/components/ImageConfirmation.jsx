import React, { memo } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function ImageConfirmation({ imageUrl, onConfirm, onUploadDifferent, onCancel, isEditMode = false }) {
  return (
    <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, gap: 10, backgroundColor: palette.surface }}>
      <Text style={{ fontWeight: '700', fontSize: 18, color: palette.text }}>Check Your Processed Image</Text>

      <View style={{ backgroundColor: palette.surfaceSoft, borderRadius: 12, padding: 8 }}>
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 320, borderRadius: 10 }} />
      </View>

      <View style={{ gap: 8 }}>
        <Pressable onPress={onConfirm} style={{ padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm Image</Text>
        </Pressable>
        <Pressable onPress={onUploadDifferent} style={{ padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text }}>Upload Different Image</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
          <Text style={{ color: palette.text }}>{isEditMode ? 'Back to Edit' : 'Return to Wardrobe'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(ImageConfirmation);
