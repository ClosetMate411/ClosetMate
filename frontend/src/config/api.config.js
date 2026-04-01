/**
 * API Configuration
 * Fully synced with the Updated Gateway Endpoints
 */

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://apigateway-production-b91d.up.railway.app',
  timeout: 90000,
  headers: {
    'Accept': 'application/json',
  },
};

export const API_ENDPOINTS = {
  // Health
  healthAll: '/api/health/all',

  // Images
  processImage: '/api/images/process',

  // Auth
  register: '/api/auth/register',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  verifyEmail: '/api/auth/verify-email',
  verifyLogin: '/api/auth/verify-login',
  resendCode: '/api/auth/resend-code',

  // Wardrobe
  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,

  // Outfits
  generateOutfits: '/api/outfits/generate',
  saveOutfit: '/api/outfits/save',
  outfits: '/api/outfits',
  outfit: (id) => `/api/outfits/${id}`,
  favoriteOutfit: (id) => `/api/outfits/${id}/favorite`,
  wardrobeStats: '/api/outfits/wardrobe/stats',
  itemAttributes: (id) => `/api/outfits/items/${id}/attributes`,
  reanalyzeItem: (id) => `/api/outfits/items/${id}/reanalyze`,

  // Community
  communityFeed: '/api/community/feed',
  communityTopRated: '/api/community/top-rated',
  communityNotifications: '/api/community/notifications',
  communityNotificationsRead: '/api/community/notifications/read',
  communityFavorites: '/api/community/favorites',
  communityFavorite: (sharedOutfitId) => `/api/community/${sharedOutfitId}/favorite`,
  communityUserSearch: '/api/community/users/search',
  communityUserProfile: (userId) => `/api/community/users/${userId}`,
  communityShare: '/api/community/share',
  communityUnshare: (sharedOutfitId) => `/api/community/${sharedOutfitId}`,
  communityRate: (sharedOutfitId) => `/api/community/${sharedOutfitId}/rate`,
  communityReact: (sharedOutfitId) => `/api/community/${sharedOutfitId}/react`,
  communityComments: (sharedOutfitId) => `/api/community/${sharedOutfitId}/comments`,
  communityComment: (commentId) => `/api/community/comments/${commentId}`,
};

export default API_CONFIG;
