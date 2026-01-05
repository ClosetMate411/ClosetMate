/**
 * API Service with Axios
 * Handles all HTTP requests to the backend
 */

import axios from 'axios';
import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

// Request interceptor - for adding auth tokens, logging, etc.
axiosInstance.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    // config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - for error handling
axiosInstance.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.data?.detail || `Error: ${error.response.status}`;
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

class APIService {
  // ==================== Wardrobe Item APIs ====================

  /**
   * Get all wardrobe items
   * @returns {Promise<Array>} List of wardrobe items
   */
  async getAllItems() {
    return axiosInstance.get(API_ENDPOINTS.items);
  }

  /**
   * Get a single wardrobe item by ID
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Wardrobe item
   */
  async getItem(itemId) {
    return axiosInstance.get(API_ENDPOINTS.item(itemId));
  }

  /**
   * Create a new wardrobe item
   * @param {Object} itemData - { name, season, image (File) }
   * @returns {Promise<Object>} Created item
   */
  async createItem(itemData) {
    const formData = new FormData();
    
    // Backend expects 'item_name' not 'name'
    if (itemData.name) formData.append('item_name', itemData.name);
    if (itemData.season) formData.append('season', itemData.season);
    if (itemData.image) formData.append('image', itemData.image);

    return axiosInstance.post(API_ENDPOINTS.items, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Update an existing wardrobe item
   * @param {string} itemId - Item ID
   * @param {Object} itemData - { name, season, image (File) }
   * @returns {Promise<Object>} Updated item
   */
  async updateItem(itemId, itemData) {
    const formData = new FormData();
    
    // Backend expects 'item_name' not 'name'
    if (itemData.name !== undefined) formData.append('item_name', itemData.name);
    if (itemData.season !== undefined) formData.append('season', itemData.season);
    if (itemData.image) formData.append('image', itemData.image);

    return axiosInstance.put(API_ENDPOINTS.item(itemId), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Delete a wardrobe item
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteItem(itemId) {
    return axiosInstance.delete(API_ENDPOINTS.item(itemId));
  }

  // ==================== Image Processing API ====================

  /**
   * Process an image (background removal, etc.)
   * @param {File} imageFile - Image file to process
   * @returns {Promise<Object>} Processed image data
   */
  async processImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    return axiosInstance.post(API_ENDPOINTS.processImage, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

// Export singleton instance
const apiService = new APIService();
export default apiService;
