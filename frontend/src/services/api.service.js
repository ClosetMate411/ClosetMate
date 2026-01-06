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
      config.headers.Authorization = `Bearer ${token}`;
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
    const f = new FormData();
    Object.entries(userData).forEach(([key, val]) => {
      const backendKey = key === 'confirmPassword' ? 'confirm_password' : 
                         key === 'fullName' ? 'full_name' : key;
      f.append(backendKey, val);
    });
    return axiosInstance.post(API_ENDPOINTS.register, f);
  }

  async login(creds) {
    const f = new FormData();
    f.append('email', creds.email);
    f.append('password', creds.password);
    return axiosInstance.post(API_ENDPOINTS.login, f);
  }

  async logout() { return axiosInstance.post(API_ENDPOINTS.logout); }
  async getCurrentUser() { return axiosInstance.get(API_ENDPOINTS.me); }
  
  async forgotPassword(email) {
    const f = new FormData();
    f.append('email', email);
    return axiosInstance.post(API_ENDPOINTS.forgotPassword, f);
  }

  async resetPassword(data) {
    const f = new FormData();
    f.append('token', data.token);
    f.append('new_password', data.newPassword);
    f.append('confirm_password', data.confirmPassword);
    return axiosInstance.post(API_ENDPOINTS.resetPassword, f);
  }

  // --- WARDROBE ---
  async getAllItems() { return axiosInstance.get(API_ENDPOINTS.items); }
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
}

const apiService = new APIService();
export default apiService;
