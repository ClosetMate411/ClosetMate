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
  healthAll: '/api/health/all',
  processImage: '/api/images/process',

  register: '/api/auth/register',
  login: '/api/auth/login',
  verifyLogin: '/api/auth/verify-login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  avatar: '/api/auth/avatar',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  resendCode: '/api/auth/resend-code',
  verifyRegistration: '/api/auth/verify-email',

  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,

  outfits: '/api/outfits',
  outfit: (id) => `/api/outfits/${id}`,
  saveOutfit: '/api/outfits/save',
  favoriteOutfit: (id) => `/api/outfits/${id}/favorite`,
  generateOutfits: '/api/outfits/generate',
  wardrobeStats: '/api/outfits/wardrobe/stats',

  communityFeed: '/api/community/feed',
  communityTopRated: '/api/community/top-rated',
  communityFavorites: '/api/community/favorites',
  communityNotifications: '/api/community/notifications',
  communityMarkNotificationsRead: '/api/community/notifications/read',
  communityUserSearch: '/api/community/users/search',
  communityUserProfile: (id) => `/api/community/users/${id}`,
  communityShare: '/api/community/share',
  communityUnshare: (id) => `/api/community/${id}`,
  communityToggleFavorite: (id) => `/api/community/${id}/favorite`,
  communityReact: (id) => `/api/community/${id}/react`,
  communityRate: (id) => `/api/community/${id}/rate`,
  communityComments: (id) => `/api/community/${id}/comments`,
  communityDeleteComment: (id) => `/api/community/comments/${id}`,
};

export default API_CONFIG;
