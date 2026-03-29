import { create } from 'zustand';
import apiService from '../services/api.service';

const useCommunityStore = create((set, get) => ({
  feed: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  loading: false,
  loadingMore: false,
  error: null,

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
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId
          ? { ...item, ratings: { ...item.ratings, user_rating: score } }
          : item
      ),
    }));
    await apiService.rateOutfit(sharedOutfitId, score);
  },

  // Optimistic: toggle reaction counts immediately
  reactToOutfit: async (sharedOutfitId, emojiType) => {
    const response = await apiService.reactToOutfit(sharedOutfitId, emojiType);
    const { action } = response.data;
    set((state) => ({
      feed: state.feed.map((item) => {
        if (item.id !== sharedOutfitId) return item;
        const counts = { ...item.reactions.counts };
        const userReactions = [...item.reactions.user_reactions];
        if (action === 'added') {
          counts[emojiType] = (counts[emojiType] || 0) + 1;
          return {
            ...item,
            reactions: { counts, user_reactions: [...userReactions, emojiType] },
          };
        } else {
          counts[emojiType] = Math.max(0, (counts[emojiType] || 1) - 1);
          if (!counts[emojiType]) delete counts[emojiType];
          return {
            ...item,
            reactions: {
              counts,
              user_reactions: userReactions.filter((r) => r !== emojiType),
            },
          };
        }
      }),
    }));
  },

  incrementCommentCount: (sharedOutfitId) => {
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId
          ? { ...item, comment_count: item.comment_count + 1 }
          : item
      ),
    }));
  },

  decrementCommentCount: (sharedOutfitId) => {
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === sharedOutfitId
          ? { ...item, comment_count: Math.max(0, item.comment_count - 1) }
          : item
      ),
    }));
  },
}));

export default useCommunityStore;
