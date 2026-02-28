import React, { memo, useState } from 'react';
import { Pressable, View, Text, Image } from 'react-native';
import { palette } from '../../../theme/colors';

function ClothingCard({ item, onClick }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = item?.image || item?.image_url;
  const name = item?.name || item?.item_name || 'Untitled';
  const isMuted = !!item?.isMuted;

  return (
    <Pressable onPress={() => onClick(item)} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, gap: 10, backgroundColor: palette.surface }}>
      <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: imageFailed ? palette.surfaceSoft : 'transparent' }}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: 220 }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={{ width: '100%', height: 220, backgroundColor: palette.surfaceSoft }} />
        )}
      </View>
      <Text style={{ fontWeight: '700', color: isMuted ? palette.textMuted : palette.text }}>{name}</Text>
    </Pressable>
  );
}

export default memo(ClothingCard);
