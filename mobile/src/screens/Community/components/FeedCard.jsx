import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../../theme/colors';
import apiService from '../../../services/api.service';

const REACTIONS = [
  { key: 'like', emoji: '👍' },
  { key: 'love', emoji: '❤️' },
  { key: 'fire', emoji: '🔥' },
  { key: 'cool', emoji: '😎' },
  { key: 'wow', emoji: '😮' },
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

function FeedCard({ item, onReact, onRate, onOpenComments }) {
  const userName = item?.user?.full_name || item?.user?.name || item?.user_name || 'User';
  const avatarLetter = userName.charAt(0).toUpperCase();
  const timestamp = formatTimeAgo(item?.created_at || item?.createdAt);
  const outfitName = item?.outfit?.name || item?.outfit_name || 'Outfit';
  const cohesionScore = item?.outfit?.cohesion_score || item?.cohesion_score;
  const reactions = item?.reactions || {};
  const myReactions = item?.my_reactions || [];
  const myRating = item?.my_rating || 0;
  const averageRating = item?.average_rating;
  const ratingCount = item?.rating_count || 0;
  const commentCount = item?.comment_count || item?.comments_count || 0;
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
      }).catch(err => console.log('Failed to fetch outfit details for community card', err));
    }
    return () => { mounted = false; };
  }, [item?.outfit?.id, item?.outfit_id]);

  const outfitItems = useMemo(() => {
    // Prefer detailedOutfit items if we fetched them
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: palette.primary,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{avatarLetter}</Text>
        </View>
        <View>
          <Text style={{ fontWeight: '700', color: palette.text, fontSize: 15 }}>{userName}</Text>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>{timestamp}</Text>
        </View>
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
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text, flex: 1 }}>{outfitName}</Text>
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

      {/* Social Row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: palette.border,
        paddingTop: 10,
      }}>
        {/* Reactions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {REACTIONS.map(({ key, emoji }) => {
            const count = reactions[key] || 0;
            const isActive = myReactions.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => onReact?.(shareId, key)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 5, paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isActive ? palette.primarySoft : 'transparent',
                }}
              >
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={{ fontSize: 11, color: palette.textMuted, marginLeft: 2, fontWeight: '600' }}>{count}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Stars + Comments */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => onRate?.(shareId, star)} hitSlop={4}>
                <Text style={{
                  fontSize: 16,
                  color: star <= (hoverStar || myRating) ? '#f59e0b' : '#d1d5db',
                }}>★</Text>
              </Pressable>
            ))}
            {(averageRating != null || ratingCount > 0) && (
              <Text style={{ fontSize: 11, color: palette.primary, fontWeight: '700', marginLeft: 4 }}>
                {averageRating != null ? averageRating.toFixed?.(1) || averageRating : ratingCount}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => onOpenComments?.(item)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={palette.textMuted} />
            <Text style={{ fontSize: 12, color: palette.textMuted, fontWeight: '600' }}>{commentCount}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default memo(FeedCard);
