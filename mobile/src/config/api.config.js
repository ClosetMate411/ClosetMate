export const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://apigateway-production-b91d.up.railway.app',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
};

if (__DEV__) {
  // Helps verify which API base URL Expo is using at runtime.
  console.log('[API_CONFIG] baseURL =', API_CONFIG.baseURL);
}

export const API_ENDPOINTS = {
  // Health
  healthAll: '/api/health/all',

  // Images
  processImage: '/api/images/process',

  // Auth
  register: '/api/auth/register',
  login: '/api/auth/login',
  verifyLogin: '/api/auth/verify-login',
  verifyEmail: '/api/auth/verify-email',
  verifyRegistration: '/api/auth/verify-email',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  avatar: '/api/auth/avatar',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  resendCode: '/api/auth/resend-code',
  refresh: '/api/auth/refresh',

  // Wardrobe
  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,
  verifyImage: '/api/wardrobe/verify-image',

  // Outfits
  outfits: '/api/outfits',
  outfit: (id) => `/api/outfits/${id}`,
  favoriteOutfit: (id) => `/api/outfits/${id}/favorite`,
  generateOutfits: '/api/outfits/generate',
  saveOutfit: '/api/outfits/save',
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
  communityDeleteComment: (commentId) => `/api/community/comments/${commentId}`,
};

export default API_CONFIG;
