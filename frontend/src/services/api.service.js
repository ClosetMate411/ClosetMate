/**
 * API Service with Axios
 * Handles all HTTP requests to the backend
 */

import axios from 'axios';
import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';

// Initialize Axios
const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

/**
 * Request Interceptor
 * Dynamically injects the token from localStorage['token']
 */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Ensure headers object exists and set Authorization
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Error Extractor Helper
 */
const extractErrorMessage = (data) => {
  if (!data) return null;
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    const err = data.errors[0];
    return err.message || err.msg || (typeof err === 'string' ? err : JSON.stringify(err));
  }
  if (data.error) {
    if (typeof data.error === 'string') return data.error;
    if (data.error.message) return data.error.message;
  }
  if (data.detail) {
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail[0].msg || data.detail[0].message;
    }
    return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  }
  return data.message || null;
};

/**
 * Response Interceptor
 */
axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === false) {
      const msg = extractErrorMessage(response.data) || 'Operation failed';
      const error = new Error(msg);
      error.data = response.data; 
      throw error;
    }
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data;

    // Global session expiry check
    if (status === 401 || status === 403) {
      const code = errorData?.error?.code || errorData?.code;
      // Don't wipe for login errors, only for expired sessions
      if (code !== 'INVALID_CREDENTIALS' && code !== 'ACCOUNT_LOCKED') {
         // The authStore.init() or subsequent requests will handle the cleanup
      }
    }

    if (error.response) {
      const message = extractErrorMessage(errorData) || `Error: ${status}`;
      const newError = new Error(message);
      newError.data = errorData;
      throw newError;
    }
    throw new Error(error.message || 'Network error');
  }
);

class APIService {
  // --- AUTH ---
  async register(userData) {
    const body = {
      email: userData.email,
      password: userData.password,
      confirm_password: userData.confirmPassword,
      full_name: userData.fullName
    };
    return axiosInstance.post(API_ENDPOINTS.register, body);
  }

  async login(creds) {
    const body = {
      email: creds.email,
      password: creds.password
    };
    return axiosInstance.post(API_ENDPOINTS.login, body);
  }

  async logout() { return axiosInstance.post(API_ENDPOINTS.logout); }
  async getCurrentUser() { return axiosInstance.get(API_ENDPOINTS.me); }
  
  async forgotPassword(email) {
    return axiosInstance.post(API_ENDPOINTS.forgotPassword, { email });
  }

  async resetPassword(data) {
    const body = {
      token: data.token,
      new_password: data.newPassword,
      confirm_password: data.confirmPassword
    };
    return axiosInstance.post(API_ENDPOINTS.resetPassword, body);
  }

  async verifyEmail(email, code) {
    return axiosInstance.post(API_ENDPOINTS.verifyEmail, { email, code });
  }

  async verifyLogin(email, code) {
    return axiosInstance.post(API_ENDPOINTS.verifyLogin, { email, code });
  }

  async resendCode(email, purpose) {
    return axiosInstance.post(API_ENDPOINTS.resendCode, { email, purpose });
  }

  // --- WARDROBE ---
  async getAllItems() { return axiosInstance.get(API_ENDPOINTS.items); }
  async getItem(id) { return axiosInstance.get(API_ENDPOINTS.item(id)); }
  async createItem(data) {
    const f = new FormData();
    if (data.name) f.append('item_name', data.name);
    if (data.season) f.append('season', data.season);
    if (data.image) f.append('image', data.image);
    return axiosInstance.post(API_ENDPOINTS.items, f, { headers: {'Content-Type': 'multipart/form-data'} });
  }
  async updateItem(id, data) {
    const f = new FormData();
    if (data.name !== undefined) f.append('item_name', data.name);
    if (data.season !== undefined) f.append('season', data.season);
    if (data.image) f.append('image', data.image);
    return axiosInstance.put(API_ENDPOINTS.item(id), f, { headers: {'Content-Type': 'multipart/form-data'} });
  }
  async deleteItem(id) { return axiosInstance.delete(API_ENDPOINTS.item(id)); }

  // --- IMAGES ---
  async processImage(file) {
    const f = new FormData();
    f.append('image', file);
    return axiosInstance.post(API_ENDPOINTS.processImage, f, { headers: {'Content-Type': 'multipart/form-data'} });
  }

  // --- OUTFITS ---
  async generateOutfits(params) {
    return axiosInstance.post(API_ENDPOINTS.generateOutfits, params);
  }

  async saveOutfit(outfitData) {
    return axiosInstance.post(API_ENDPOINTS.saveOutfit, outfitData);
  }

  async getOutfits() {
    return axiosInstance.get(API_ENDPOINTS.outfits);
  }

  async getOutfit(id) {
    return axiosInstance.get(API_ENDPOINTS.outfit(id));
  }

  async toggleFavoriteOutfit(id) {
    return axiosInstance.put(API_ENDPOINTS.favoriteOutfit(id), {});
  }

  async deleteOutfit(id) {
    return axiosInstance.delete(API_ENDPOINTS.outfit(id));
  }

  async getWardrobeStats() {
    return axiosInstance.get(API_ENDPOINTS.wardrobeStats);
  }

  async getItemAttributes(id) {
    return axiosInstance.get(API_ENDPOINTS.itemAttributes(id));
  }

  async reanalyzeItem(id, imageUrl) {
    return axiosInstance.post(API_ENDPOINTS.reanalyzeItem(id), { image_url: imageUrl });
  }

  // --- COMMUNITY ---
  async getCommunityFeed(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityFeed, { params: { page, limit } });
  }

  async shareOutfit(data) {
    return axiosInstance.post(API_ENDPOINTS.communityShare, data);
  }

  async unshareOutfit(sharedOutfitId) {
    return axiosInstance.delete(API_ENDPOINTS.communityUnshare(sharedOutfitId));
  }

  async rateOutfit(sharedOutfitId, score) {
    return axiosInstance.post(API_ENDPOINTS.communityRate(sharedOutfitId), { score });
  }

  async reactToOutfit(sharedOutfitId, emojiType) {
    return axiosInstance.post(API_ENDPOINTS.communityReact(sharedOutfitId), { emoji_type: emojiType });
  }

  async getComments(sharedOutfitId, page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityComments(sharedOutfitId), { params: { page, limit } });
  }

  async addComment(sharedOutfitId, text) {
    return axiosInstance.post(API_ENDPOINTS.communityComments(sharedOutfitId), { text });
  }

  async deleteComment(commentId) {
    return axiosInstance.delete(API_ENDPOINTS.communityComment(commentId));
  }
}

const apiService = new APIService();
export default apiService;
