import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function EmptyWardrobe({ onAddClick }) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: palette.text }}>Wardrobe</Text>
        <Text style={{ color: palette.textMuted }}>Upload items to build your digital wardrobe.</Text>
      </View>

      <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 16, gap: 8, alignItems: 'center', backgroundColor: palette.surface }}>
        <Text style={{ textAlign: 'center', color: palette.textMuted }}>
          Your wardrobe is empty. Start by adding your first clothing item!
        </Text>
        <Pressable onPress={onAddClick} style={{ marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 10, borderColor: palette.primary, backgroundColor: palette.primary }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Add Item</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(EmptyWardrobe);
