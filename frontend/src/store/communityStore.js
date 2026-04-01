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

  // Optimistic: update user_rating immediately, server confirms
  rateOutfit: async (sharedOutfitId, score) => {
    const { feed } = get();
    const idx = feed.findIndex((item) => item.id === sharedOutfitId);
    if (idx === -1) return;
    const updated = { ...feed[idx], ratings: { ...feed[idx].ratings, user_rating: score } };
    const newFeed = [...feed];
    newFeed[idx] = updated;
    set({ feed: newFeed });
    await apiService.rateOutfit(sharedOutfitId, score);
  },

  // Optimistic: toggle reaction counts immediately
  reactToOutfit: async (sharedOutfitId, emojiType) => {
    const response = await apiService.reactToOutfit(sharedOutfitId, emojiType);
    const { action } = response.data;
    const { feed } = get();
    const idx = feed.findIndex((item) => item.id === sharedOutfitId);
    if (idx === -1) return;
    const item = feed[idx];
    const counts = { ...item.reactions.counts };
    let userReactions;
    if (action === 'added') {
      counts[emojiType] = (counts[emojiType] || 0) + 1;
      userReactions = [...item.reactions.user_reactions, emojiType];
    } else {
      counts[emojiType] = Math.max(0, (counts[emojiType] || 1) - 1);
      if (!counts[emojiType]) delete counts[emojiType];
      userReactions = item.reactions.user_reactions.filter((r) => r !== emojiType);
    }
    const newFeed = [...feed];
    newFeed[idx] = { ...item, reactions: { counts, user_reactions: userReactions } };
    set({ feed: newFeed });
  },

  incrementCommentCount: (sharedOutfitId) => {
    const { feed } = get();
    const idx = feed.findIndex((item) => item.id === sharedOutfitId);
    if (idx === -1) return;
    const newFeed = [...feed];
    newFeed[idx] = { ...feed[idx], comment_count: feed[idx].comment_count + 1 };
    set({ feed: newFeed });
  },

  decrementCommentCount: (sharedOutfitId) => {
    const { feed } = get();
    const idx = feed.findIndex((item) => item.id === sharedOutfitId);
    if (idx === -1) return;
    const newFeed = [...feed];
    newFeed[idx] = { ...feed[idx], comment_count: Math.max(0, feed[idx].comment_count - 1) };
    set({ feed: newFeed });
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
}));

export default useCommunityStore;
