import React, { memo, useState } from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import { palette } from '../../../theme/colors';
import { radius, shadow, spacing, type } from '../../../theme/tokens';
import useWardrobeStore from '../../../store/wardrobeStore';
import { generateItemLabel } from '../../../utils/helpers';

function ClothingCard({ item, onClick }) {
  const [imageFailed, setImageFailed] = useState(false);
  const aiLabels = useWardrobeStore((s) => s.aiLabels);
  const image = item?.image || item?.image_url;
  const itemId = String(item?.id || '');
  const aiName = aiLabels[itemId] || '';
  const generatedLabel = generateItemLabel(item);
  const rawName = aiName || generatedLabel || item?.name || item?.item_name || '';
  const name = rawName.trim().toLowerCase() === 'untitled' ? '' : rawName;
  const isMuted = !!item?.isMuted;

  return (
    <Pressable
      onPress={() => onClick(item)}
      style={styles.card}
    >
      <View style={[styles.imageBox, imageFailed ? styles.imageBoxFailed : null]}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback} />
        )}
      </View>
      {name ? (
        <Text numberOfLines={2} style={[styles.name, isMuted ? styles.nameMuted : null]}>
          {name}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: palette.surfaceElevated,
    ...shadow.soft,
  },
  imageBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: palette.surfaceSoft,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBoxFailed: {
    borderWidth: 1,
    borderColor: palette.border,
  },
  image: {
    width: '88%',
    height: '88%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.surfaceSoft,
  },
  name: {
    ...type.caption,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  nameMuted: {
    color: palette.textMuted,
  },
});

export default memo(ClothingCard);
