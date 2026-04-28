import React, { memo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ClothingCard from './ClothingCard';
import ClothingDetail from './ClothingDetail';
import { palette } from '../../../theme/colors';

function ClothingGrid({
  items,
  selectedItem,
  onCardClick,
  onBack,
  onSave,
  onDelete,
  onProcessImage,
  isEditingItem,
  onEditToggle,
}) {
  const insets = useSafeAreaInsets();

  if (selectedItem) {
    return (
      <ClothingDetail
        item={selectedItem}
        onBack={onBack}
        onSave={onSave}
        onDelete={onDelete}
        onProcessImage={onProcessImage}
        isEditingItem={isEditingItem}
        onEditToggle={onEditToggle}
      />
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text }}>Your Item{items.length > 1 ? 's' : ''}</Text>
        <Text style={{ color: palette.textMuted }}>{items.length} item{items.length > 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        style={{ flex: 1, minHeight: 0 }}
        data={items}
        keyExtractor={(it) => String(it.id)}
        numColumns={3}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom + 24), gap: 10 }}
        renderItem={({ item }) => (
          <View style={{ width: '31.5%' }}>
            <ClothingCard item={item} onClick={onCardClick} />
          </View>
        )}
      />

    </View>
  );
}

export default memo(ClothingGrid);
