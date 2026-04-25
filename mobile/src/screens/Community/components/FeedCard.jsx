import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../../theme/colors';
import apiService from '../../../services/api.service';

// Backend-spec emojis: heart, fire, clap, love_eyes, idea
const REACTIONS = [
  { key: 'heart',     emoji: '❤️' },
  { key: 'fire',      emoji: '🔥' },
  { key: 'clap',      emoji: '👏' },
  { key: 'love_eyes', emoji: '😍' },
  { key: 'idea',      emoji: '💡' },
];

const getItemImage = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return (
    item.image ||
    item.image_url ||
    item.processed_image_url ||
    item.imageUrl ||
    item.processedImageUrl ||
    item.file_url ||
    item.item?.image ||
    item.item?.image_url ||
    item.item?.processed_image_url ||
    item.wardrobe_item?.image ||
    item.wardrobe_item?.image_url ||
    item.wardrobe_item?.processed_image_url ||
    item.clothing_item?.image ||
    item.clothing_item?.image_url ||
    null
  );
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

function FeedCard({ item, onReact, onRate, onOpenComments, onToggleFavorite, onUnshare, onOpenProfile }) {
  // Backend shape: shared_by, outfit, ratings{}, reactions{counts,user_reactions},
  //                comment_count, favorites{count,user_has_favorited}, shared_at
  const sharedBy = item?.shared_by || {};
  const userName = sharedBy.name || item?.user?.full_name || item?.user?.name || 'User';
  const avatarUrl = sharedBy.avatar_url || item?.user?.avatar_url || null;
  const isSelf = !!sharedBy.is_self;
  const userId = sharedBy.user_id || item?.user_id;
  const avatarLetter = (userName || '?').charAt(0).toUpperCase();

  const timestamp = formatTimeAgo(item?.shared_at || item?.created_at || item?.createdAt);
  const outfitName = item?.outfit?.name || item?.outfit_name || 'Outfit';
  const cohesionScore = item?.outfit?.cohesion_score ?? item?.cohesion_score;
  const description = item?.description;

  // Backend shapes { counts, user_reactions } — fall back to legacy flat shape
  const reactionCounts = item?.reactions?.counts || item?.reactions || {};
  const myReactions = item?.reactions?.user_reactions || item?.my_reactions || [];

  // Rating
  const myRating = item?.ratings?.user_rating ?? item?.my_rating ?? 0;
  const averageRating = item?.ratings?.average ?? item?.average_rating;
  const ratingCount = item?.ratings?.count ?? item?.rating_count ?? 0;

  // Favorites
  const favoriteCount = item?.favorites?.count ?? 0;
  const hasFavorited = !!item?.favorites?.user_has_favorited;

  const commentCount = item?.comment_count ?? item?.comments_count ?? 0;
  const shareId = item?.id || item?._id;

  const [detailedOutfit, setDetailedOutfit] = useState(null);

  useEffect(() => {
    let mounted = true;
    const outfitId = item?.outfit?.id || item?.outfit_id;
    const hasPopulatedItems = Array.isArray(item?.outfit?.items) && item.outfit.items.length > 0;

    if (outfitId && !hasPopulatedItems && !detailedOutfit) {
      apiService.getOutfit(outfitId).then(res => {
        if (mounted && res?.data?.items) {
          setDetailedOutfit(res.data);
        }
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [item?.outfit?.id, item?.outfit_id]);

  const outfitItems = useMemo(() => {
    const items = detailedOutfit?.items || item?.outfit?.items || item?.items || [];
    return Array.isArray(items) ? items.slice(0, 4) : [];
  }, [item, detailedOutfit]);

  const tags = useMemo(() => {
    const sourceOutfit = detailedOutfit || item?.outfit || item;
    const result = [];
    if (sourceOutfit?.style) result.push(sourceOutfit.style);
    if (sourceOutfit?.occasion) result.push(sourceOutfit.occasion);
    if (sourceOutfit?.season) result.push(sourceOutfit.season);
    return result.filter(Boolean);
  }, [item, detailedOutfit]);

  const [hoverStar, setHoverStar] = useState(0);

  return (
    <View style={{
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      backgroundColor: palette.surface,
      padding: 14,
      gap: 12,
    }}>
      {/* User Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => userId && !isSelf && onOpenProfile?.(userId)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: palette.primary,
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40 }} />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{avatarLetter}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontWeight: '700', color: palette.text, fontSize: 15 }} numberOfLines={1}>
                {userName}
              </Text>
              {isSelf && (
                <View style={{
                  backgroundColor: palette.primarySoft,
                  paddingHorizontal: 6, paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: palette.primary }}>You</Text>
                </View>
              )}
            </View>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>{timestamp}</Text>
          </View>
        </Pressable>

        {isSelf && onUnshare && (
          <Pressable onPress={() => onUnshare(item)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={18} color={palette.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Outfit Collage (2x2) */}
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 4,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {[0, 1, 2, 3].map((idx) => {
          const outfitItem = outfitItems[idx];
          const image = outfitItem ? getItemImage(outfitItem) : null;
          return (
            <View key={idx} style={{
              width: '48.5%', aspectRatio: 1,
              backgroundColor: palette.surfaceSoft,
              borderRadius: 8,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {image ? (
                <Image source={{ uri: image }} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
              ) : (
                <Ionicons name="shirt-outline" size={28} color={palette.borderStrong} />
              )}
            </View>
          );
        })}
      </View>

      {/* Outfit Info */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text, flex: 1 }} numberOfLines={1}>
          {outfitName}
        </Text>
        {cohesionScore != null && (
          <View style={{
            backgroundColor: cohesionScore >= 7 ? '#dcfce7' : '#fee2e2',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
          }}>
            <Text style={{
              fontWeight: '700', fontSize: 13,
              color: cohesionScore >= 7 ? '#16a34a' : '#dc2626',
            }}>{cohesionScore}/10</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((tag) => (
            <View key={tag} style={{
              borderWidth: 1, borderColor: palette.border,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
              backgroundColor: palette.surfaceSoft,
            }}>
              <Text style={{ fontSize: 12, color: palette.textMuted, fontWeight: '600' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {description ? (
        <Text style={{ fontSize: 13, color: palette.textMuted, lineHeight: 18 }} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      {/* Social — two rows to avoid horizontal overflow on narrow phones */}
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, gap: 10 }}>
        {/* Row 1: Reactions (spec: ONE emoji per user; tapping another switches) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {REACTIONS.map(({ key, emoji }) => {
            const count = reactionCounts[key] || 0;
            const isActive = myReactions.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => onReact?.(shareId, key)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 6, paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isActive ? palette.primarySoft : 'transparent',
                  borderWidth: 1,
                  borderColor: isActive ? palette.primary : 'transparent',
                }}
              >
                <Text style={{ fontSize: 15 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={{ fontSize: 11, color: palette.textMuted, marginLeft: 3, fontWeight: '600' }}>{count}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Row 2: Stars + average + favorite + comments */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 1 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => !isSelf && onRate?.(shareId, star)}
                onPressIn={() => !isSelf && setHoverStar(star)}
                onPressOut={() => setHoverStar(0)}
                hitSlop={4}
              >
                <Text style={{
                  fontSize: 15,
                  color: star <= (hoverStar || myRating) ? '#f59e0b' : '#d1d5db',
                }}>★</Text>
              </Pressable>
            ))}
            {(averageRating != null || ratingCount > 0) && (
              <Text
                style={{ fontSize: 11, color: palette.primary, fontWeight: '700', marginLeft: 4 }}
                numberOfLines={1}
              >
                {averageRating != null ? Number(averageRating).toFixed(1) : ''}
                {ratingCount > 0 ? ` (${ratingCount})` : ''}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => onToggleFavorite?.(shareId)}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Text style={{ fontSize: 15 }}>{hasFavorited ? '❤️' : '🤍'}</Text>
              {favoriteCount > 0 && (
                <Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: '600' }}>{favoriteCount}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => onOpenComments?.(item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chatbubble-outline" size={15} color={palette.textMuted} />
              <Text style={{ fontSize: 12, color: palette.textMuted, fontWeight: '600' }}>{commentCount}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(FeedCard);
