import { create } from 'zustand';
import apiService from '../services/api.service';

const useCommunityStore = create((set, get) => ({
  // Feed
  feedItems: [],
  loading: false,
  refreshing: false,
  error: null,
  page: 1,
  hasMore: true,

  // Top rated
  topRatedItems: [],
  topRatedLoading: false,
  topRatedPage: 1,
  topRatedHasMore: true,

  // Notifications
  notifications: [],
  unreadCount: 0,
  notificationsLoading: false,
  notificationsPage: 1,
  notificationsHasMore: true,

  // Favorites
  favorites: [],
  favoritesLoading: false,
  favoritesPage: 1,
  favoritesHasMore: true,

  // ─── Feed ─────────────────────────────────────────────────────────
  fetchFeed: async (reset = false) => {
    const state = get();
    if (state.loading || (!reset && !state.hasMore)) return;

    const nextPage = reset ? 1 : state.page;
    set({ loading: true, error: null, ...(reset ? { refreshing: true } : {}) });

    try {
      const response = await apiService.getCommunityFeed(nextPage, 20);
      const items = Array.isArray(response?.data) ? response.data : [];

      set((prev) => ({
        feedItems: reset ? items : [...prev.feedItems, ...items],
        page: nextPage + 1,
        hasMore: items.length >= 20,
        loading: false,
        refreshing: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false, refreshing: false });
    }
  },

  refreshFeed: async () => {
    await get().fetchFeed(true);
  },

  clearFeed: () => set({ feedItems: [], page: 1, hasMore: true, error: null }),

  // ─── Top Rated ────────────────────────────────────────────────────
  fetchTopRated: async (reset = false) => {
    const state = get();
    if (state.topRatedLoading || (!reset && !state.topRatedHasMore)) return;

    const nextPage = reset ? 1 : state.topRatedPage;
    set({ topRatedLoading: true });

    try {
      const response = await apiService.getTopRated(nextPage, 20);
      const items = Array.isArray(response?.data) ? response.data : [];

      set((prev) => ({
        topRatedItems: reset ? items : [...prev.topRatedItems, ...items],
        topRatedPage: nextPage + 1,
        topRatedHasMore: items.length >= 20,
        topRatedLoading: false,
      }));
    } catch (_e) {
      set({ topRatedLoading: false });
    }
  },

  refreshTopRated: async () => {
    set({ topRatedPage: 1, topRatedHasMore: true });
    await get().fetchTopRated(true);
  },

  // ─── Notifications ────────────────────────────────────────────────
  fetchNotifications: async (reset = false) => {
    const state = get();
    if (state.notificationsLoading || (!reset && !state.notificationsHasMore)) return;

    const nextPage = reset ? 1 : state.notificationsPage;
    set({ notificationsLoading: true });

    try {
      const response = await apiService.getNotifications(nextPage, 20);
      const items = Array.isArray(response?.data) ? response.data : [];
      const unread = response?.unread_count ?? get().unreadCount;

      set((prev) => ({
        notifications: reset ? items : [...prev.notifications, ...items],
        notificationsPage: nextPage + 1,
        notificationsHasMore: items.length >= 20,
        unreadCount: unread,
        notificationsLoading: false,
      }));
    } catch (_e) {
      set({ notificationsLoading: false });
    }
  },

  markNotificationsRead: async () => {
    try {
      await apiService.markNotificationsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (_e) { /* silent */ }
  },

  // ─── Favorites ────────────────────────────────────────────────────
  fetchFavorites: async (reset = false) => {
    const state = get();
    if (state.favoritesLoading || (!reset && !state.favoritesHasMore)) return;

    const nextPage = reset ? 1 : state.favoritesPage;
    set({ favoritesLoading: true });

    try {
      const response = await apiService.getFavorites(nextPage, 20);
      const items = Array.isArray(response?.data) ? response.data : [];

      set((prev) => ({
        favorites: reset ? items : [...prev.favorites, ...items],
        favoritesPage: nextPage + 1,
        favoritesHasMore: items.length >= 20,
        favoritesLoading: false,
      }));
    } catch (_e) {
      set({ favoritesLoading: false });
    }
  },

  toggleFavoriteShared: async (sharedOutfitId) => {
    // Optimistic across feedItems, topRatedItems, and favorites
    const updateList = (list) => list.map((item) => {
      if ((item.id || item._id) !== sharedOutfitId) return item;
      const favorites = item.favorites || {};
      const now = !!favorites.user_has_favorited;
      return {
        ...item,
        favorites: {
          count: Math.max(0, (favorites.count || 0) + (now ? -1 : 1)),
          user_has_favorited: !now,
        },
      };
    });

    set((state) => ({
      feedItems: updateList(state.feedItems),
      topRatedItems: updateList(state.topRatedItems),
      favorites: updateList(state.favorites),
    }));

    try {
      await apiService.toggleFavoriteShared(sharedOutfitId);
    } catch (_e) {
      await get().fetchFeed(true);
    }
  },

  // ─── Share / Unshare ──────────────────────────────────────────────
  shareOutfit: async (outfitId, description) => {
    set({ loading: true, error: null });
    try {
      await apiService.shareOutfit(outfitId, description);
      await get().fetchFeed(true);
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return { success: false, error: error.message };
    }
  },

  unshareOutfit: async (sharedOutfitId) => {
    try {
      await apiService.unshareOutfit(sharedOutfitId);
      set((state) => ({
        feedItems: state.feedItems.filter((i) => (i.id || i._id) !== sharedOutfitId),
        topRatedItems: state.topRatedItems.filter((i) => (i.id || i._id) !== sharedOutfitId),
        favorites: state.favorites.filter((i) => (i.id || i._id) !== sharedOutfitId),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ─── Reactions / Ratings ──────────────────────────────────────────
  // Spec: exactly ONE emoji per user per post. Tapping the same emoji removes
  // it; tapping a different one switches (old decrements, new increments).
  addReaction: async (shareId, emojiType) => {
    const updateList = (list) => list.map((item) => {
      if ((item.id || item._id) !== shareId) return item;
      const reactions = { ...(item.reactions?.counts || item.reactions || {}) };
      const myReactions = [...(item.reactions?.user_reactions || item.my_reactions || [])];
      const existingEmoji = myReactions[0]; // there can only ever be one

      if (existingEmoji === emojiType) {
        // Toggle off
        reactions[emojiType] = Math.max(0, (reactions[emojiType] || 1) - 1);
        myReactions.length = 0;
      } else {
        // Switch: remove the old one if any, add the new one
        if (existingEmoji) {
          reactions[existingEmoji] = Math.max(0, (reactions[existingEmoji] || 1) - 1);
        }
        reactions[emojiType] = (reactions[emojiType] || 0) + 1;
        myReactions.length = 0;
        myReactions.push(emojiType);
      }

      return {
        ...item,
        reactions: { counts: reactions, user_reactions: myReactions },
        my_reactions: myReactions,
      };
    });

    set((state) => ({
      feedItems: updateList(state.feedItems),
      topRatedItems: updateList(state.topRatedItems),
      favorites: updateList(state.favorites),
    }));

    try {
      await apiService.addReaction(shareId, emojiType);
    } catch (_e) {
      await get().fetchFeed(true);
    }
  },

  rateOutfit: async (shareId, score) => {
    const updateList = (list) => list.map((item) => {
      if ((item.id || item._id) !== shareId) return item;
      return {
        ...item,
        ratings: { ...(item.ratings || {}), user_rating: score },
        my_rating: score,
      };
    });

    set((state) => ({
      feedItems: updateList(state.feedItems),
      topRatedItems: updateList(state.topRatedItems),
      favorites: updateList(state.favorites),
    }));

    try {
      const response = await apiService.rateOutfit(shareId, score);
      if (response?.data?.avg_rating !== undefined) {
        const avg = response.data.avg_rating;
        const count = response.data.rating_count;
        const patchAvg = (list) => list.map((item) => {
          if ((item.id || item._id) !== shareId) return item;
          return {
            ...item,
            ratings: { ...(item.ratings || {}), average: avg, count, user_rating: score },
          };
        });
        set((state) => ({
          feedItems: patchAvg(state.feedItems),
          topRatedItems: patchAvg(state.topRatedItems),
          favorites: patchAvg(state.favorites),
        }));
      }
    } catch (_e) {
      await get().fetchFeed(true);
    }
  },

  // ─── Comments ─────────────────────────────────────────────────────
  incrementCommentCount: (shareId) => {
    const bump = (list) => list.map((item) => {
      if ((item.id || item._id) !== shareId) return item;
      return { ...item, comment_count: (item.comment_count || 0) + 1 };
    });
    set((state) => ({
      feedItems: bump(state.feedItems),
      topRatedItems: bump(state.topRatedItems),
      favorites: bump(state.favorites),
    }));
  },

  decrementCommentCount: (shareId) => {
    const dec = (list) => list.map((item) => {
      if ((item.id || item._id) !== shareId) return item;
      return { ...item, comment_count: Math.max(0, (item.comment_count || 0) - 1) };
    });
    set((state) => ({
      feedItems: dec(state.feedItems),
      topRatedItems: dec(state.topRatedItems),
      favorites: dec(state.favorites),
    }));
  },
}));

export default useCommunityStore;
