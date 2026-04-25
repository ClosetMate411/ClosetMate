import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useCommunityStore from '../../store/communityStore';
import FeedCard from '../Community/components/FeedCard';
import CommentsModal from '../Community/components/CommentsModal';
import { palette } from '../../theme/colors';

export default function TopRatedScreen() {
  const navigation = useNavigation();
  const items = useCommunityStore((s) => s.topRatedItems);
  const loading = useCommunityStore((s) => s.topRatedLoading);
  const hasMore = useCommunityStore((s) => s.topRatedHasMore);
  const fetchTopRated = useCommunityStore((s) => s.fetchTopRated);
  const refreshTopRated = useCommunityStore((s) => s.refreshTopRated);
  const addReaction = useCommunityStore((s) => s.addReaction);
  const rateOutfit = useCommunityStore((s) => s.rateOutfit);
  const toggleFavoriteShared = useCommunityStore((s) => s.toggleFavoriteShared);

  const [commentsItem, setCommentsItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchTopRated(true); }, [fetchTopRated]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTopRated();
    setRefreshing(false);
  }, [refreshTopRated]);

  const renderItem = useCallback(({ item }) => (
    <FeedCard
      item={item}
      onReact={(id, emoji) => addReaction(id, emoji)}
      onRate={(id, score) => rateOutfit(id, score)}
      onOpenComments={setCommentsItem}
      onToggleFavorite={toggleFavoriteShared}
      onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
    />
  ), [addReaction, rateOutfit, toggleFavoriteShared, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ padding: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text }}>🏆 Top Rated</Text>
        <Text style={{ color: palette.textMuted, marginTop: 2 }}>Highest-rated community outfits</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 42, marginBottom: 10 }}>⭐</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center' }}>
            No rated outfits yet
          </Text>
          <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 6 }}>
            Rate some outfits in the community feed to populate this list.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i?.id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
          onEndReached={() => hasMore && fetchTopRated(false)}
          onEndReachedThreshold={0.5}
        />
      )}

      <CommentsModal visible={!!commentsItem} onClose={() => setCommentsItem(null)} shareItem={commentsItem} />
    </View>
  );
}
