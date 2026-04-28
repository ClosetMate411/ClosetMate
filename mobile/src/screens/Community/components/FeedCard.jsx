import React, { memo, useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../../../theme/colors';
import { radius, shadow, spacing, type } from '../../../theme/tokens';
import apiService from '../../../services/api.service';
import useAuthStore from '../../../store/authStore';

const REACTIONS = [
  { key: 'heart', emoji: '❤️' },
  { key: 'fire', emoji: '🔥' },
  { key: 'clap', emoji: '👏' },
  { key: 'love_eyes', emoji: '😍' },
  { key: 'idea', emoji: '💡' },
];
const AVATAR_GRADIENT = ['#7c3aed', '#c026d3'];

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

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const userNameCache = new Map();

const pickString = (...values) => (
  values.find((value) => typeof value === 'string' && value.trim().length > 0) || ''
);

const isPlaceholderName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'user' || normalized === 'u';
};

const resolveUserId = (item) => (
  item?.shared_by?.user_id ||
  item?.shared_by?.id ||
  item?.shared_by?._id ||
  item?.user?.user_id ||
  item?.user?.id ||
  item?.user?._id ||
  item?.user_id ||
  item?.shared_by_user_id ||
  item?.author_id ||
  null
);

const resolveUserNameFromItem = (item) => (
  pickString(
    item?.shared_by?.name,
    item?.user?.full_name,
    item?.user?.fullName,
    item?.user?.name,
    item?.user?.username,
    item?.user_name,
    item?.shared_by_name,
    item?.author_name,
    item?.owner_name
  )
);

function FeedCard({ item, onReact, onRate, onOpenComments, onNavigateToProfile, onToggleFavorite, onDeleteShare, forceShowDelete = false }) {
  const authUserRaw = useAuthStore((store) => store.user);
  const authUser = authUserRaw?.user && typeof authUserRaw.user === 'object' ? authUserRaw.user : authUserRaw;
  const currentUserId = authUser?.id || authUser?._id || authUser?.user_id || authUser?.uid || null;
  const currentUserName = pickString(
    authUser?.full_name,
    authUser?.fullName,
    authUser?.name,
    authUser?.username,
    authUser?.email
  );

  const userId = resolveUserId(item);
  const [resolvedUserName, setResolvedUserName] = useState('');
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState(
    item?.shared_by?.avatar_url || item?.shared_by?.avatarUrl || null
  );
  const inlineUserName = resolveUserNameFromItem(item);
  const safeInlineUserName = isPlaceholderName(inlineUserName) ? '' : inlineUserName;
  const userName = resolvedUserName || safeInlineUserName || 'User';
  const isSelfPost =
    item?.shared_by?.is_self === true ||
    (!!currentUserId && !!userId && String(currentUserId) === String(userId));
  const avatarLetter = (userName || 'U').charAt(0).toUpperCase();
  const timestamp = formatRelativeTime(
    item?.shared_at || item?.created_at || item?.createdAt
  );
  const outfitName = item?.outfit?.name || item?.outfit_name || 'Outfit';
  const cohesionScore = item?.outfit?.cohesion_score || item?.cohesion_score;
  const rawReactions = item?.reactions || {};
  const reactions = rawReactions?.counts && typeof rawReactions.counts === 'object'
    ? rawReactions.counts
    : rawReactions;
  const myReactions = Array.isArray(item?.my_reactions)
    ? item.my_reactions
    : (Array.isArray(rawReactions?.user_reactions) ? rawReactions.user_reactions : []);
  const favoriteState = item?.favorites || {};
  const isFavoritedByMe = !!favoriteState?.user_has_favorited;
  const favoriteCount = Number(favoriteState?.count || 0);
  const myRating = item?.my_rating || item?.ratings?.user_rating || 0;
  const averageRating = item?.average_rating ?? item?.ratings?.average;
  const ratingCount = item?.rating_count ?? item?.ratings?.count ?? 0;
  const commentCount = item?.comment_count || item?.comments_count || 0;
  const shareId = item?.id || item?._id;
  const hasRatingSummary = averageRating != null || Number(ratingCount) > 0;
  const averageRatingValue = averageRating != null ? Number(averageRating) : null;
  const averageRatingLabel = averageRatingValue != null && Number.isFinite(averageRatingValue)
    ? (Number.isInteger(averageRatingValue) ? String(averageRatingValue) : averageRatingValue.toFixed(1))
    : null;

  const [detailedOutfit, setDetailedOutfit] = useState(null);
  const [isReacting, setIsReacting] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (safeInlineUserName) {
      setResolvedUserName(safeInlineUserName);
      setResolvedAvatarUrl(item?.shared_by?.avatar_url || item?.shared_by?.avatarUrl || null);
      return () => { mounted = false; };
    }

    // If backend returns placeholder user label, prefer the logged-in user's name for self posts.
    if (currentUserName && (isSelfPost || (!userId && isPlaceholderName(inlineUserName)))) {
      setResolvedUserName(currentUserName);
      setResolvedAvatarUrl(authUser?.avatar_url || authUser?.avatarUrl || null);
      return () => { mounted = false; };
    }

    if (!userId) {
      setResolvedUserName('');
      setResolvedAvatarUrl(null);
      return () => { mounted = false; };
    }

    const cacheKey = String(userId);
    const cachedName = userNameCache.get(cacheKey);
    if (cachedName) {
      setResolvedUserName(cachedName);
      return () => { mounted = false; };
    }

    // Fallback: fetch profile name if feed payload omitted user details.
    apiService.getUserProfile(userId)
      .then((res) => {
        if (!mounted) return;
        const profilePayload = res?.data || res || {};
        const profileUser = profilePayload?.user || profilePayload;
        const fetchedName = pickString(
          profileUser?.full_name,
          profileUser?.fullName,
          profileUser?.name,
          profileUser?.username
        );
        const fetchedAvatarUrl = profileUser?.avatar_url || profileUser?.avatarUrl || null;
        if (fetchedName) {
          userNameCache.set(cacheKey, fetchedName);
          setResolvedUserName(fetchedName);
        }
        if (fetchedAvatarUrl) {
          setResolvedAvatarUrl(fetchedAvatarUrl);
        }
      })
      .catch(() => {
        // Keep UI fallback as "User" if profile fetch fails.
        if (!mounted) return;
        if (currentUserName && isPlaceholderName(inlineUserName)) {
          setResolvedUserName(currentUserName);
          setResolvedAvatarUrl(authUser?.avatar_url || authUser?.avatarUrl || null);
        }
      });

    return () => { mounted = false; };
  }, [item, userId, inlineUserName, safeInlineUserName, currentUserId, currentUserName, authUser]);

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
  }, [item?.outfit?.id, item?.outfit_id, item?.outfit?.items, detailedOutfit]);

  const outfitItems = useMemo(() => {
    // Prefer detailedOutfit items if we fetched them
    const items = detailedOutfit?.items || item?.outfit?.items || item?.items || [];
    return Array.isArray(items) ? items.slice(0, 4) : [];
  }, [item, detailedOutfit]);

  const handleReactPress = async (targetShareId, key) => {
    if (!targetShareId || isReacting) return;
    setIsReacting(true);
    try {
      await onReact?.(targetShareId, key);
    } finally {
      setIsReacting(false);
    }
  };

  const handleRatePress = async (targetShareId, star) => {
    if (!targetShareId || isRating) return;
    setIsRating(true);
    try {
      await onRate?.(targetShareId, star);
    } finally {
      setIsRating(false);
    }
  };

  const handleFavoritePress = async (targetShareId) => {
    if (!targetShareId || isFavoriting) return;
    setIsFavoriting(true);
    try {
      await onToggleFavorite?.(targetShareId);
    } finally {
      setIsFavoriting(false);
    }
  };

  const tags = useMemo(() => {
    const sourceOutfit = detailedOutfit || item?.outfit || item;
    const result = [];
    if (sourceOutfit?.style) result.push(sourceOutfit.style);
    if (sourceOutfit?.occasion) result.push(sourceOutfit.occasion);
    if (sourceOutfit?.season) result.push(sourceOutfit.season);
    return result.filter(Boolean);
  }, [item, detailedOutfit]);

  return (
    <View style={styles.card}>
      {/* User Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => onNavigateToProfile?.(userId)} style={styles.headerUserPressable}>
          {resolvedAvatarUrl ? (
            <Image source={{ uri: resolvedAvatarUrl }} style={styles.avatarCircle} />
          ) : (
            <LinearGradient
              colors={AVATAR_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </LinearGradient>
          )}
          <View>
            <View style={styles.userRow}>
              <Text style={styles.userName}>{userName}</Text>
              {isSelfPost ? (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
        </Pressable>
        {(forceShowDelete || isSelfPost) && shareId ? (
          <Pressable onPress={() => onDeleteShare?.(item, shareId)} hitSlop={8} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.collage}>
        {[0, 1, 2, 3].map((idx) => {
          const outfitItem = outfitItems[idx];
          const image = outfitItem ? getItemImage(outfitItem) : null;
          return (
            <View key={idx} style={styles.collageCell}>
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
      <View style={styles.outfitMetaRow}>
        <Text style={styles.outfitName}>{outfitName}</Text>
        {cohesionScore != null && (
          <View style={[styles.scorePill, cohesionScore >= 7 ? styles.scoreGood : styles.scoreBad]}>
            <Text style={[styles.scoreText, cohesionScore >= 7 ? styles.scoreGoodText : styles.scoreBadText]}>{cohesionScore}/10</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {item?.description ? (
        <Text style={styles.descriptionText}>{item.description}</Text>
      ) : null}

      <View style={styles.socialRow}>
        <View style={styles.reactionRow}>
          {REACTIONS.map(({ key, emoji }) => {
            const count = reactions[key] || 0;
            const isActive = myReactions.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => handleReactPress(shareId, key)}
                disabled={isReacting}
                style={[styles.reactionButton, isActive ? styles.reactionActive : null]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {count > 0 ? <Text style={styles.reactionCount}>{count}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => handleRatePress(shareId, star)} hitSlop={4} disabled={isRating}>
                <Text style={{
                  fontSize: 16,
                  color: star <= myRating ? '#f59e0b' : '#d1d5db',
                }}>★</Text>
              </Pressable>
            ))}
            {hasRatingSummary && (
              <Text style={styles.ratingText}>
                {averageRatingLabel || '0.0'} <Text style={styles.ratingCountText}>({Number(ratingCount) || 0})</Text>
              </Text>
            )}
          </View>
          <View style={styles.rightMetaRow}>
            <Pressable
              onPress={() => handleFavoritePress(shareId)}
              disabled={isFavoriting}
              style={styles.favoriteButton}
            >
              <Text style={styles.favoriteEmoji}>{isFavoritedByMe ? '❤️' : '🤍'}</Text>
              {favoriteCount > 0 ? <Text style={styles.favoriteCount}>{favoriteCount}</Text> : null}
            </Pressable>

            <Pressable
              onPress={() => onOpenComments?.(item)}
              style={styles.commentButton}
            >
              <Text style={styles.commentEmoji}>💬</Text>
              <Text style={styles.commentCount}>{commentCount}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadow.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerUserPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 8,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    ...type.label,
    color: palette.text,
    fontWeight: '700',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#e9d5ff',
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6d28d9',
  },
  timestamp: {
    ...type.caption,
    color: palette.textMuted,
  },
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  collageCell: {
    width: '48.5%',
    aspectRatio: 1,
    backgroundColor: palette.surfaceSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outfitMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outfitName: {
    ...type.title,
    color: palette.text,
    flex: 1,
  },
  scorePill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  scoreGood: {
    backgroundColor: '#dcfce7',
  },
  scoreBad: {
    backgroundColor: '#fee2e2',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreGoodText: {
    color: '#16a34a',
  },
  scoreBadText: {
    color: '#dc2626',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    backgroundColor: palette.surfaceSoft,
  },
  tagText: {
    ...type.caption,
    color: palette.textMuted,
    fontWeight: '600',
  },
  descriptionText: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: 'column',
    gap: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.xs + 2,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  reactionActive: {
    backgroundColor: palette.primarySoft,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 11,
    color: palette.textMuted,
    marginLeft: 2,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rightMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoriteEmoji: {
    fontSize: 16,
  },
  favoriteCount: {
    ...type.caption,
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '700',
    marginLeft: 4,
  },
  ratingCountText: {
    color: palette.textMuted,
    fontWeight: '600',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentEmoji: {
    fontSize: 16,
  },
  commentCount: {
    ...type.caption,
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default memo(FeedCard);
