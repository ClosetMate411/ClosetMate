/**
 * API Configuration
 * Centralized configuration for API endpoints and settings
 */

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

export const API_ENDPOINTS = {
  // Wardrobe items
  items: '/api/wardrobe/items',
  item: (id) => `/api/wardrobe/items/${id}`,
  
  // Image processing
  processImage: '/api/images/process',
};

export default API_CONFIG;

