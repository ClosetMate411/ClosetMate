import React, { memo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import ClothingCard from './ClothingCard';
import ClothingDetail from './ClothingDetail';
import { palette } from '../../../theme/colors';

function ClothingGrid({
  items,
  onAddClick,
  selectedItem,
  onCardClick,
  onBack,
  onSave,
  onDelete,
  onProcessImage,
  isEditingItem,
  onEditToggle,
}) {
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
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text }}>Your Item{items.length > 1 ? 's' : ''}</Text>
        <Text style={{ color: palette.textMuted }}>{items.length} item{items.length > 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingBottom: 20, gap: 10 }}
        renderItem={({ item }) => (
          <ClothingCard item={item} onClick={onCardClick} />
        )}
      />

      <Pressable onPress={onAddClick} style={{ paddingVertical: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Add Item</Text>
      </Pressable>
    </View>
  );
}

export default memo(ClothingGrid);
