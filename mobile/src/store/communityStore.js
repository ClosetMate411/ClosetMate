import { create } from 'zustand';
import apiService from '../services/api.service';

const PAGE_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 15000;

const emptyPagination = { page: 0, pages: 0, total: 0, limit: PAGE_LIMIT };

const mergePage = (prevItems, nextItems, reset) => (reset ? nextItems : [...prevItems, ...nextItems]);
const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const sortNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a?.shared_at || a?.created_at || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.shared_at || b?.created_at || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });

const dedupeById = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = String(item?.id || item?._id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
};

const hasMoreFrom = (pagination, fetchedCount, limit = PAGE_LIMIT) => {
  if (pagination?.pages && pagination?.page) return pagination.page < pagination.pages;
  return fetchedCount >= limit;
};

const updatePostAcrossLists = (state, shareId, updater) => {
  const update = (arr) => arr.map((item) => ((item?.id || item?._id) === shareId ? updater(item) : item));
  return {
    feedItems: update(state.feedItems),
    topRatedItems: update(state.topRatedItems),
    favoriteItems: update(state.favoriteItems),
  };
};

// Mirror of community_service /community/top-rated formula
// (backend: SUM(rating.score) * 10 + COUNT(reactions) * 10).
// Used to optimistically re-rank Top Rated items in-place after a rating
// change or reaction toggle so the user's own action is reflected
// immediately, before the silent background re-fetch reconciles.
const computeTopRatedScore = (item) => {
  const avg = Number(item?.ratings?.average ?? item?.average_rating ?? 0);
  const count = Number(item?.ratings?.count ?? item?.rating_count ?? 0);
  const ratingPoints = avg * count * 10;

  const counts = item?.reactions?.counts || {};
  const reactionCount = Object.values(counts).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0,
  );
  const reactionPoints = reactionCount * 10;

  return ratingPoints + reactionPoints;
};

const sortByTopRated = (items = []) =>
  [...items].sort((a, b) => {
    const scoreDiff = computeTopRatedScore(b) - computeTopRatedScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    // Tie-break: newer first, matches backend ORDER BY shared_at DESC
    const aTime = new Date(a?.shared_at || 0).getTime();
    const bTime = new Date(b?.shared_at || 0).getTime();
    return bTime - aTime;
  });

const updateAndResortTopRated = (state, shareId, updater) => {
  const updated = updatePostAcrossLists(state, shareId, updater);
  return { ...updated, topRatedItems: sortByTopRated(updated.topRatedItems) };
};

const useCommunityStore = create((set, get) => ({
  feedItems: [],
  topRatedItems: [],
  favoriteItems: [],
  notifications: [],

  feedPagination: emptyPagination,
  topRatedPagination: emptyPagination,
  favoritePagination: emptyPagination,
  notificationsPagination: emptyPagination,

  unreadCount: 0,

  loading: false,
  refreshing: false,
  loadingMore: false,
  topRatedLoading: false,
  topRatedLoadingMore: false,
  favoritesLoading: false,
  favoritesLoadingMore: false,
  notificationsLoading: false,
  notificationsLoadingMore: false,

  hasMore: true,
  topRatedHasMore: true,
  favoritesHasMore: true,
  notificationsHasMore: true,
  error: null,

  fetchFeed: async (reset = false, options = {}) => {
    const { silent = false } = options;
    const state = get();
    if (state.loading || state.loadingMore || (!reset && !state.hasMore)) return;
    const nextPage = reset ? 1 : (state.feedPagination.page || 0) + 1;
    set({
      error: null,
      ...(!silent ? (reset ? { loading: true, refreshing: true } : { loadingMore: true }) : {}),
    });
    try {
      const response = await withTimeout(
        apiService.getCommunityFeed(nextPage, PAGE_LIMIT),
        REQUEST_TIMEOUT_MS,
        'Loading feed timed out. Please try again.'
      );
      const items = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || { ...emptyPagination, page: nextPage, limit: PAGE_LIMIT };
      set((prev) => ({
        feedItems: sortNewestFirst(dedupeById(mergePage(prev.feedItems, items, reset))),
        feedPagination: {
          page: pagination.page || nextPage,
          pages: pagination.pages || 0,
          total: pagination.total || 0,
          limit: pagination.limit || PAGE_LIMIT,
        },
        hasMore: hasMoreFrom(pagination, items.length, PAGE_LIMIT),
        ...(!silent ? { loading: false, refreshing: false, loadingMore: false } : {}),
      }));
    } catch (error) {
      set({ error: error.message, ...(!silent ? { loading: false, refreshing: false, loadingMore: false } : {}) });
    }
  },

  fetchTopRated: async (reset = false, options = {}) => {
    const { silent = false } = options;
    const state = get();
    if (state.topRatedLoading || state.topRatedLoadingMore || (!reset && !state.topRatedHasMore)) return;
    const nextPage = reset ? 1 : (state.topRatedPagination.page || 0) + 1;
    set({ error: null, ...(!silent ? (reset ? { topRatedLoading: true } : { topRatedLoadingMore: true }) : {}) });
    try {
      const response = await withTimeout(
        apiService.getCommunityTopRated(nextPage, PAGE_LIMIT),
        REQUEST_TIMEOUT_MS,
        'Loading top rated timed out. Please try again.'
      );
      const items = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || { ...emptyPagination, page: nextPage, limit: PAGE_LIMIT };
      set((prev) => ({
        topRatedItems: mergePage(prev.topRatedItems, items, reset),
        topRatedPagination: {
          page: pagination.page || nextPage,
          pages: pagination.pages || 0,
          total: pagination.total || 0,
          limit: pagination.limit || PAGE_LIMIT,
        },
        topRatedHasMore: hasMoreFrom(pagination, items.length, PAGE_LIMIT),
        ...(!silent ? { topRatedLoading: false, topRatedLoadingMore: false } : {}),
      }));
    } catch (error) {
      set({ error: error.message, ...(!silent ? { topRatedLoading: false, topRatedLoadingMore: false } : {}) });
    }
  },

  fetchFavorites: async (reset = false, options = {}) => {
    const { silent = false } = options;
    const state = get();
    if (state.favoritesLoading || state.favoritesLoadingMore || (!reset && !state.favoritesHasMore)) return;
    const nextPage = reset ? 1 : (state.favoritePagination.page || 0) + 1;
    set({ error: null, ...(!silent ? (reset ? { favoritesLoading: true } : { favoritesLoadingMore: true }) : {}) });
    try {
      const response = await withTimeout(
        apiService.getCommunityFavorites(nextPage, PAGE_LIMIT),
        REQUEST_TIMEOUT_MS,
        'Loading favorites timed out. Please try again.'
      );
      const items = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || { ...emptyPagination, page: nextPage, limit: PAGE_LIMIT };
      set((prev) => ({
        favoriteItems: mergePage(prev.favoriteItems, items, reset),
        favoritePagination: {
          page: pagination.page || nextPage,
          pages: pagination.pages || 0,
          total: pagination.total || 0,
          limit: pagination.limit || PAGE_LIMIT,
        },
        favoritesHasMore: hasMoreFrom(pagination, items.length, PAGE_LIMIT),
        ...(!silent ? { favoritesLoading: false, favoritesLoadingMore: false } : {}),
      }));
    } catch (error) {
      set({ error: error.message, ...(!silent ? { favoritesLoading: false, favoritesLoadingMore: false } : {}) });
    }
  },

  fetchNotifications: async (reset = false, options = {}) => {
    const { silent = false } = options;
    const state = get();
    if (state.notificationsLoading || state.notificationsLoadingMore || (!reset && !state.notificationsHasMore)) return;
    const nextPage = reset ? 1 : (state.notificationsPagination.page || 0) + 1;
    set({ error: null, ...(!silent ? (reset ? { notificationsLoading: true } : { notificationsLoadingMore: true }) : {}) });
    try {
      const response = await withTimeout(
        apiService.getCommunityNotifications(nextPage, PAGE_LIMIT),
        REQUEST_TIMEOUT_MS,
        'Loading notifications timed out. Please try again.'
      );
      const items = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || { ...emptyPagination, page: nextPage, limit: PAGE_LIMIT };
      set((prev) => ({
        notifications: mergePage(prev.notifications, items, reset),
        notificationsPagination: {
          page: pagination.page || nextPage,
          pages: pagination.pages || 0,
          total: pagination.total || 0,
          limit: pagination.limit || PAGE_LIMIT,
        },
        notificationsHasMore: hasMoreFrom(pagination, items.length, PAGE_LIMIT),
        unreadCount: Number(response?.unread_count ?? prev.unreadCount ?? 0),
        ...(!silent ? { notificationsLoading: false, notificationsLoadingMore: false } : {}),
      }));
    } catch (error) {
      set({ error: error.message, ...(!silent ? { notificationsLoading: false, notificationsLoadingMore: false } : {}) });
    }
  },

  markAllRead: async () => {
    try {
      await apiService.markCommunityNotificationsRead();
      set((state) => ({
        unreadCount: 0,
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      }));
    } catch (error) {
      set({ error: error.message });
    }
  },

  // alias for backward compatibility
  markNotificationsRead: async () => {
    await get().markAllRead();
  },

  refreshFeed: async () => {
    await get().fetchFeed(true);
  },

  shareOutfit: async (outfitId, description = null) => {
    try {
      await apiService.shareOutfit(outfitId, description);
      await get().fetchFeed(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  unshareOutfit: async (sharedOutfitId) => {
    const targetId = String(sharedOutfitId || '');
    if (!targetId) return { success: false, error: 'Shared outfit id is missing.' };

    try {
      await apiService.unshareOutfit(targetId);
      set((state) => {
        const removeById = (arr) => arr.filter((item) => String(item?.id || item?._id || '') !== targetId);
        return {
          feedItems: removeById(state.feedItems),
          topRatedItems: removeById(state.topRatedItems),
          favoriteItems: removeById(state.favoriteItems),
          notifications: (state.notifications || []).filter(
            (n) => String(n?.shared_outfit_id || n?.sharedOutfitId || '') !== targetId
          ),
          feedPagination: {
            ...state.feedPagination,
            total: Math.max(0, Number(state.feedPagination?.total || 0) - 1),
          },
        };
      });
      return { success: true };
    } catch (error) {
      await Promise.all([
        get().fetchFeed(true),
        get().fetchTopRated(true),
        get().fetchFavorites(true),
        get().fetchNotifications(true),
      ]);
      return { success: false, error: error.message };
    }
  },

  addReaction: async (shareId, emojiType) => {
    try {
      const response = await apiService.addReaction(shareId, emojiType);
      const emojiCounts = response?.data?.emoji_counts || {};
      const myReactions = Array.isArray(response?.data?.my_reactions) ? response.data.my_reactions : [];
      const newReactions = { counts: emojiCounts, user_reactions: myReactions };
      set((state) => updateAndResortTopRated(state, shareId, (item) => ({
        ...item,
        reactions: newReactions,
        my_reactions: myReactions,
      })));
      // Reconcile against backend in case other users reacted concurrently.
      get().fetchTopRated(true, { silent: true }).catch(() => {});
    } catch (_e) {
      await Promise.all([get().fetchFeed(true), get().fetchTopRated(true), get().fetchFavorites(true)]);
    }
  },

  toggleFavorite: async (shareId) => {
    try {
      const response = await apiService.toggleCommunityFavorite(shareId);
      const action = response?.data?.action;
      const favoriteCount = Number(response?.data?.favorite_count || 0);
      set((state) => updatePostAcrossLists(state, shareId, (item) => ({
        ...item,
        favorites: {
          ...(item?.favorites || {}),
          user_has_favorited: action === 'added',
          count: favoriteCount,
        },
      })));
      await get().fetchFavorites(true);
    } catch (_e) {
      await Promise.all([get().fetchFeed(true), get().fetchTopRated(true), get().fetchFavorites(true)]);
    }
  },

  rateOutfit: async (shareId, score) => {
    try {
      const response = await apiService.rateOutfit(shareId, score);
      const average = response?.data?.average;
      const count = Number(response?.data?.count || 0);
      set((state) => updateAndResortTopRated(state, shareId, (item) => ({
        ...item,
        my_rating: score,
        ratings: {
          ...(item?.ratings || {}),
          average,
          count,
          user_rating: score,
        },
        average_rating: average,
        rating_count: count,
      })));
      // Background reconcile so concurrent activity from other users is
      // reflected in Top Rated ranking.
      get().fetchTopRated(true, { silent: true }).catch(() => {});
    } catch (_e) {
      await Promise.all([get().fetchFeed(true), get().fetchTopRated(true), get().fetchFavorites(true)]);
    }
  },

  incrementCommentCount: (sharedOutfitId) => {
    set((state) => updatePostAcrossLists(state, sharedOutfitId, (item) => {
      const current = Number(item?.comment_count || 0);
      return { ...item, comment_count: current + 1 };
    }));
  },

  decrementCommentCount: (sharedOutfitId) => {
    set((state) => updatePostAcrossLists(state, sharedOutfitId, (item) => {
      const current = Number(item?.comment_count || 0);
      return { ...item, comment_count: Math.max(0, current - 1) };
    }));
  },

  clearFeed: () => set({
    feedItems: [],
    topRatedItems: [],
    favoriteItems: [],
    notifications: [],
    feedPagination: emptyPagination,
    topRatedPagination: emptyPagination,
    favoritePagination: emptyPagination,
    notificationsPagination: emptyPagination,
    unreadCount: 0,
    hasMore: true,
    topRatedHasMore: true,
    favoritesHasMore: true,
    notificationsHasMore: true,
    error: null,
  }),
}));

export default useCommunityStore;
