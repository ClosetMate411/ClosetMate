import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function ProcessingError({ retryCount, errorMessage, onRetry, onUploadDifferent, onReturn }) {
  return (
    <View style={{ borderWidth: 1, borderColor: '#f1b6ca', backgroundColor: palette.dangerSoft, borderRadius: 12, padding: 12, gap: 10 }}>
      <Text style={{ fontWeight: '700', fontSize: 16, color: palette.text }}>Background Removal Failed</Text>
      <Text style={{ color: palette.textMuted }}>
        We couldn&apos;t process your image. This could be due to a poor internet connection or an unsupported image format.
      </Text>
      {errorMessage ? <Text style={{ color: palette.danger }}>Details: {errorMessage}</Text> : null}

      <View style={{ gap: 8 }}>
        {retryCount < 2 ? (
          <Pressable onPress={onRetry} style={{ padding: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry Processing ({retryCount}/2)</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onUploadDifferent} style={{ padding: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Upload Different Image</Text>
          </Pressable>
        )}

        <Pressable onPress={onReturn} style={{ padding: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text }}>Return to Wardrobe</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(ProcessingError);
