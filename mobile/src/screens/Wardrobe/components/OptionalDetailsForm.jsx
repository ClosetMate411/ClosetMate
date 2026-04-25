import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function OptionalDetailsForm({ onSave, onSkip }) {
  const handleSave = useCallback(() => {
    onSave?.({});
  }, [onSave]);

  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: palette.textMuted, fontSize: 14 }}>
        AI will automatically generate a descriptive name for your item based on its color, material, and type.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable onPress={handleSkip} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
          <Text style={{ color: palette.text }}>SKIP</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(OptionalDetailsForm);
