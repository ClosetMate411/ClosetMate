import { create } from 'zustand';
import apiService from '../services/api.service';

const sortNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a?.shared_at || a?.created_at || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.shared_at || b?.created_at || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });

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

  fetchFeed: async (page = 1, options = {}) => {
    const { silent = false } = options;
    if (page === 1 && !silent) {
      set({ loading: true, error: null });
    } else if (!silent) {
      set({ loadingMore: true });
    }
    try {
      const response = await apiService.getCommunityFeed(page);
      const { data, pagination } = response;
      set((state) => ({
        feed: sortNewestFirst(page === 1 ? data : [...state.feed, ...data]),
        pagination,
        ...(!silent ? { loading: false, loadingMore: false } : {}),
      }));
    } catch (error) {
      set({ error: error.message, ...(!silent ? { loading: false, loadingMore: false } : {}) });
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

  // Use backend's authoritative emoji_counts + my_reactions for accuracy
  reactToOutfit: async (sharedOutfitId, emojiType) => {
    const response = await apiService.reactToOutfit(sharedOutfitId, emojiType);
    const { emoji_counts, my_reactions } = response.data;
    const newReactions = { counts: emoji_counts, user_reactions: my_reactions };

    const applyUpdate = (item) =>
      item.id === sharedOutfitId ? { ...item, reactions: newReactions } : item;

    set((state) => ({
      feed: state.feed.map(applyUpdate),
      topRated: state.topRated.map(applyUpdate),
      favorites: state.favorites.map(applyUpdate),
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
  fetchTopRated: async (page = 1, options = {}) => {
    const { silent = false } = options;
    if (!silent) set({ topRatedLoading: true });
    try {
      const response = await apiService.getTopRated(page);
      set({
        topRated: response.data || [],
        topRatedPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        ...(!silent ? { topRatedLoading: false } : {}),
      });
    } catch (error) {
      if (!silent) set({ topRatedLoading: false });
      throw error;
    }
  },

  // ── Notifications ──
  fetchNotifications: async (page = 1, options = {}) => {
    const { silent = false } = options;
    if (!silent) set({ notificationsLoading: true });
    try {
      const response = await apiService.getNotifications(page);
      set({
        notifications: response.data || [],
        unreadCount: response.unread_count || 0,
        notificationsPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        ...(!silent ? { notificationsLoading: false } : {}),
      });
    } catch (error) {
      if (!silent) set({ notificationsLoading: false });
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
  fetchFavorites: async (page = 1, options = {}) => {
    const { silent = false } = options;
    if (!silent) set({ favoritesLoading: true });
    try {
      const response = await apiService.getFavorites(page);
      set({
        favorites: response.data || [],
        favoritesPagination: response.pagination || { page, limit: 20, total: 0, pages: 0 },
        ...(!silent ? { favoritesLoading: false } : {}),
      });
    } catch (error) {
      if (!silent) set({ favoritesLoading: false });
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
