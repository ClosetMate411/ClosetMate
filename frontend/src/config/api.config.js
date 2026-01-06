/**
 * API Configuration
 * Fully synced with the Updated Gateway Endpoints
 */

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://apigateway-production-b91d.up.railway.app',
  timeout: 30000,
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

  // Wardrobe
  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,
};

export default API_CONFIG;
