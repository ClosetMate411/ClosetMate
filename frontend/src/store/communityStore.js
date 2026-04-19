import { create } from 'zustand';
import apiService from '../services/api.service';

const useCommunityStore = create((set, get) => ({
  feed: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  loading: false,
  loadingMore: false,
  error: null,

  // Top Rated
  topRated: [],
  topRatedPagination: { page: 1, limit: 20, total: 0, pages: 0 },
  topRatedLoading: false,

  // Notifications
  notifications: [],
  notificationsPagination: { page: 1, limit: 20, total: 0, pages: 0 },
  notificationsLoading: false,
  unreadCount: 0,

  // Favorites
  favorites: [],
  favoritesPagination: { page: 1, limit: 20, total: 0, pages: 0 },
  favoritesLoading: false,

  fetchFeed: async (page = 1) => {
    if (page === 1) {
      set({ loading: true, error: null });
    } else {
      set({ loadingMore: true });
    }
    try {
      const response = await apiService.getCommunityFeed(page);
      const { data, pagination } = response;
      set((state) => ({
        feed: page === 1 ? data : [...state.feed, ...data],
        pagination,
        loading: false,
        loadingMore: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false, loadingMore: false });
      throw error;
    }
  },

  shareOutfit: async (outfitId, description) => {
    const response = await apiService.shareOutfit({ outfit_id: outfitId, description });
    // Refresh page 1 so the new post appears at the top
    await get().fetchFeed(1);
    return response.data;
  },

  unshareOutfit: async (sharedOutfitId) => {
    await apiService.unshareOutfit(sharedOutfitId);
    set((state) => ({
      feed: state.feed.filter((item) => item.id !== sharedOutfitId),
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
    }));
  },

  // Rate and update from backend response (accurate average/count)
  rateOutfit: async (sharedOutfitId, score) => {
    const response = await apiService.rateOutfit(sharedOutfitId, score);
    const { average, count } = response.data;
    const newRatings = { average, count, user_rating: score };

    set((state) => {
      const updatedTopRated = state.topRated
        .map((item) => (item.id === sharedOutfitId ? { ...item, ratings: newRatings } : item))
        .sort((a, b) => {
          const avgDiff = (b.ratings.average || 0) - (a.ratings.average || 0);
          return avgDiff !== 0 ? avgDiff : (b.ratings.count || 0) - (a.ratings.count || 0);
        });

      return {
        feed: state.feed.map((item) =>
          item.id === sharedOutfitId ? { ...item, ratings: newRatings } : item
        ),
        topRated: updatedTopRated,
      };
    });
  },

  // Apply reaction change based on backend action: added | removed | switched
  reactToOutfit: async (sharedOutfitId, emojiType) => {
    const response = await apiService.reactToOutfit(sharedOutfitId, emojiType);
    const { action, previous_emoji_type: previousEmojiType } = response.data;

    set((state) => ({
      feed: state.feed.map((item) => {
        if (item.id !== sharedOutfitId) return item;
        const counts = { ...item.reactions.counts };
        let userReactions = [...item.reactions.user_reactions];

        if (action === 'added') {
          counts[emojiType] = (counts[emojiType] || 0) + 1;
          userReactions = [...userReactions, emojiType];
        } else if (action === 'removed') {
          counts[emojiType] = Math.max(0, (counts[emojiType] || 1) - 1);
          if (!counts[emojiType]) delete counts[emojiType];
          userReactions = userReactions.filter((r) => r !== emojiType);
        } else if (action === 'switched' && previousEmojiType) {
          counts[previousEmojiType] = Math.max(0, (counts[previousEmojiType] || 1) - 1);
          if (!counts[previousEmojiType]) delete counts[previousEmojiType];
          counts[emojiType] = (counts[emojiType] || 0) + 1;
          userReactions = userReactions.filter((r) => r !== previousEmojiType);
          userReactions.push(emojiType);
        }

        return { ...item, reactions: { counts, user_reactions: userReactions } };
      }),
    }));
  },

  incrementCommentCount: (sharedOutfitId) => {
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId ? { ...item, comment_count: item.comment_count + 1 } : item
      ),
    }));
  },

  decrementCommentCount: (sharedOutfitId) => {
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId ? { ...item, comment_count: Math.max(0, item.comment_count - 1) } : item
      ),
    }));
  },

  // ── Top Rated ──
  fetchTopRated: async (page = 1) => {
    set({ topRatedLoading: true });
    try {
      const response = await apiService.getTopRated(page);
      set({
        topRated: response.data || [],
        topRatedPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        topRatedLoading: false,
      });
    } catch (error) {
      set({ topRatedLoading: false });
      throw error;
    }
  },

  // ── Notifications ──
  fetchNotifications: async (page = 1) => {
    set({ notificationsLoading: true });
    try {
      const response = await apiService.getNotifications(page);
      set({
        notifications: response.data || [],
        unreadCount: response.unread_count || 0,
        notificationsPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        notificationsLoading: false,
      });
    } catch (error) {
      set({ notificationsLoading: false });
      throw error;
    }
  },

  markAllRead: async () => {
    try {
      await apiService.markNotificationsRead();
      set((state) => ({
        unreadCount: 0,
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      }));
    } catch {
      // silent fail
    }
  },

  // ── Favorites ──
  fetchFavorites: async (page = 1) => {
    set({ favoritesLoading: true });
    try {
      const response = await apiService.getFavorites(page);
      set({
        favorites: response.data || [],
        favoritesPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        favoritesLoading: false,
      });
    } catch (error) {
      set({ favoritesLoading: false });
      throw error;
    }
  },

  toggleFavorite: async (sharedOutfitId) => {
    const response = await apiService.toggleFavorite(sharedOutfitId);
    const { action, favorite_count } = response.data;
    const isFavorited = action === 'added';
    const newFavorites = { count: favorite_count, user_has_favorited: isFavorited };

    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId ? { ...item, favorites: newFavorites } : item
      ),
      topRated: state.topRated.map((item) =>
        item.id === sharedOutfitId ? { ...item, favorites: newFavorites } : item
      ),
    }));

    return { action, favorite_count };
  },
}));

export default useCommunityStore;
