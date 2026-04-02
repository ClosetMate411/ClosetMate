import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import useCommunityStore from '../../store/communityStore';
import FeedCard from './components/FeedCard';
import CommentsModal from './components/CommentsModal';
import ShareOutfitModal from './components/ShareOutfitModal';
import { palette } from '../../theme/colors';

export default function CommunityScreen() {
  const feedItems = useCommunityStore((s) => s.feedItems);
  const loading = useCommunityStore((s) => s.loading);
  const refreshing = useCommunityStore((s) => s.refreshing);
  const fetchFeed = useCommunityStore((s) => s.fetchFeed);
  const refreshFeed = useCommunityStore((s) => s.refreshFeed);
  const addReaction = useCommunityStore((s) => s.addReaction);
  const rateOutfit = useCommunityStore((s) => s.rateOutfit);
  const shareOutfit = useCommunityStore((s) => s.shareOutfit);

  const [commentsItem, setCommentsItem] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  const handleReact = useCallback((shareId, emojiType) => {
    addReaction(shareId, emojiType);
  }, [addReaction]);

  const handleRate = useCallback((shareId, score) => {
    rateOutfit(shareId, score);
  }, [rateOutfit]);

  const handleOpenComments = useCallback((item) => {
    setCommentsItem(item);
  }, []);

  const handleShare = useCallback(async (outfitId) => {
    return shareOutfit(outfitId);
  }, [shareOutfit]);

  const renderItem = useCallback(({ item }) => (
    <FeedCard
      item={item}
      onReact={handleReact}
      onRate={handleRate}
      onOpenComments={handleOpenComments}
    />
  ), [handleReact, handleRate, handleOpenComments]);

  const keyExtractor = useCallback((item) => String(item?.id || item?._id || Math.random()), []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
      }}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text }}>Community</Text>
          <Text style={{ color: palette.textMuted, marginTop: 2 }}>
            {feedItems.length} outfit{feedItems.length !== 1 ? 's' : ''} shared
          </Text>
        </View>
        <Pressable
          onPress={() => setShareOpen(true)}
          style={{
            paddingVertical: 10, paddingHorizontal: 16,
            borderRadius: 12, backgroundColor: palette.primary,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Share Outfit</Text>
        </Pressable>
      </View>

      {/* Feed */}
      {loading && feedItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={{ color: palette.textMuted, marginTop: 10 }}>Loading community feed...</Text>
        </View>
      ) : feedItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 42, marginBottom: 10 }}>👗</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center' }}>
            No shared outfits yet
          </Text>
          <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 6 }}>
            Be the first to share an outfit with the community!
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshFeed}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
          onEndReached={() => fetchFeed(false)}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Modals */}
      <CommentsModal
        visible={!!commentsItem}
        onClose={() => setCommentsItem(null)}
        shareItem={commentsItem}
      />

      <ShareOutfitModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onShare={handleShare}
      />
    </View>
  );
}
