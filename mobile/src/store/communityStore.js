import { create } from 'zustand';
import apiService from '../services/api.service';

const useCommunityStore = create((set, get) => ({
  feedItems: [],
  loading: false,
  refreshing: false,
  error: null,
  page: 1,
  hasMore: true,

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

  shareOutfit: async (outfitId) => {
    set({ loading: true, error: null });
    try {
      await apiService.shareOutfit(outfitId);
      await get().fetchFeed(true);
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return { success: false, error: error.message };
    }
  },

  addReaction: async (shareId, emojiType) => {
    // Optimistic update
    set((state) => ({
      feedItems: state.feedItems.map((item) => {
        if ((item.id || item._id) !== shareId) return item;
        const reactions = { ...(item.reactions || {}) };
        const myReactions = [...(item.my_reactions || [])];
        const alreadyReacted = myReactions.includes(emojiType);

        if (alreadyReacted) {
          reactions[emojiType] = Math.max(0, (reactions[emojiType] || 1) - 1);
          const idx = myReactions.indexOf(emojiType);
          if (idx > -1) myReactions.splice(idx, 1);
        } else {
          reactions[emojiType] = (reactions[emojiType] || 0) + 1;
          myReactions.push(emojiType);
        }

        return { ...item, reactions, my_reactions: myReactions };
      }),
    }));

    try {
      await apiService.addReaction(shareId, emojiType);
    } catch (_e) {
      // Revert on failure by re-fetching
      await get().fetchFeed(true);
    }
  },

  rateOutfit: async (shareId, score) => {
    // Optimistic update
    set((state) => ({
      feedItems: state.feedItems.map((item) => {
        if ((item.id || item._id) !== shareId) return item;
        return { ...item, my_rating: score };
      }),
    }));

    try {
      const response = await apiService.rateOutfit(shareId, score);
      // Update with server's aggregate
      if (response?.data?.average_rating !== undefined) {
        set((state) => ({
          feedItems: state.feedItems.map((item) => {
            if ((item.id || item._id) !== shareId) return item;
            return {
              ...item,
              average_rating: response.data.average_rating,
              rating_count: response.data.rating_count,
            };
          }),
        }));
      }
    } catch (_e) {
      await get().fetchFeed(true);
    }
  },

  clearFeed: () => set({ feedItems: [], page: 1, hasMore: true, error: null }),
}));

export default useCommunityStore;
