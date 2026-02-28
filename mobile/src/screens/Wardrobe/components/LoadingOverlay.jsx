import React, { memo } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function LoadingOverlay({ uploadState, loading, onCancelUpload }) {
  const isLoading =
    loading ||
    uploadState === 'processing' ||
    uploadState === 'saving' ||
    uploadState === 'updating' ||
    uploadState === 'deleting';

  if (!isLoading) return null;

  const getLoadingMessage = () => {
    if (uploadState === 'processing') return 'Removing background...';
    if (uploadState === 'saving') return 'Saving changes...';
    if (uploadState === 'updating') return 'Updating changes...';
    if (uploadState === 'deleting') return 'Deleting item...';
    return 'Fetching your wardrobe...';
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={{ color: palette.textMuted }}>{getLoadingMessage()}</Text>
      {uploadState === 'processing' ? (
        <Pressable
          onPress={onCancelUpload}
          style={{ marginTop: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.borderStrong, backgroundColor: palette.surface }}
        >
          <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel Upload</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default memo(LoadingOverlay);
