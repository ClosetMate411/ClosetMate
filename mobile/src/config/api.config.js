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
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  resendCode: '/api/auth/resend-code',
  verifyRegistration: '/api/auth/verify-email',
  refresh: '/api/auth/refresh',

  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,

  outfits: '/api/outfits',
  outfit: (id) => `/api/outfits/${id}`,
  favoriteOutfit: (id) => `/api/outfits/${id}/favorite`,
  generateOutfits: '/api/outfits/generate',

  communityFeed: '/api/community/feed',
  communityShare: '/api/community/share',
  communityReact: (id) => `/api/community/${id}/react`,
  communityRate: (id) => `/api/community/${id}/rate`,
  communityComments: (id) => `/api/community/${id}/comments`,
  communityDeleteComment: (id) => `/api/community/comments/${id}`,
};

export default API_CONFIG;
