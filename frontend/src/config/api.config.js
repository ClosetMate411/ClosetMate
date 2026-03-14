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
};

export default API_CONFIG;
