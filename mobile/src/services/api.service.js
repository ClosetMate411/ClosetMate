import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';

const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

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
    if (error?.code === 'ERR_CANCELED') {
      throw new Error('Upload cancelled.');
    }

    const status = error.response?.status;
    const errorData = error.response?.data;

    // Global session expiry check
    if (status === 401 || status === 403) {
      const code = errorData?.error?.code || errorData?.code;
      // Don't wipe for login errors, only for expired sessions
      if (code !== 'INVALID_CREDENTIALS' && code !== 'ACCOUNT_LOCKED') {
        // authStore.init() or subsequent guarded requests will handle cleanup
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
  async register(userData) {
    return axiosInstance.post(API_ENDPOINTS.register, {
      full_name: userData.fullName,
      email: userData.email,
      password: userData.password,
      confirm_password: userData.confirmPassword,
    });
  }

  async login(creds) {
    return axiosInstance.post(API_ENDPOINTS.login, {
      email: creds.email,
      password: creds.password,
    });
  }

  async logout() { return axiosInstance.post(API_ENDPOINTS.logout); }
  async getCurrentUser() { return axiosInstance.get(API_ENDPOINTS.me); }

  async forgotPassword(email) {
    return axiosInstance.post(API_ENDPOINTS.forgotPassword, { email });
  }

  async resetPassword(data) {
    return axiosInstance.post(API_ENDPOINTS.resetPassword, {
      token: data.token,
      new_password: data.newPassword,
      confirm_password: data.confirmPassword,
    });
  }

  async getAllItems() { return axiosInstance.get(API_ENDPOINTS.items); }

  async createItem(data) {
    const f = new FormData();
    if (data.name) f.append('item_name', data.name);
    if (data.season) f.append('season', data.season);
    if (data.image) f.append('image', data.image);
    return axiosInstance.post(API_ENDPOINTS.items, f);
  }

  async updateItem(id, data) {
    const f = new FormData();
    if (data.name !== undefined) f.append('item_name', data.name);
    if (data.season !== undefined) f.append('season', data.season);
    if (data.image) f.append('image', data.image);
    return axiosInstance.put(API_ENDPOINTS.item(id), f);
  }

  async deleteItem(id) { return axiosInstance.delete(API_ENDPOINTS.item(id)); }

  async processImage(file, signal) {
    const f = new FormData();
    f.append('image', file);
    return axiosInstance.post(API_ENDPOINTS.processImage, f, { signal });
  }

  async getOutfits() {
    return axiosInstance.get(API_ENDPOINTS.outfits);
  }

  async getOutfit(id) {
    return axiosInstance.get(API_ENDPOINTS.outfit(id));
  }

  async generateOutfits(filters = {}) {
    const f = new FormData();
    f.append('count', String(filters.count ?? 3));
    f.append('season', filters.season ?? 'all');
    f.append('occasion', filters.occasion ?? 'everyday');
    f.append('style', filters.style ?? 'any');
    return axiosInstance.post(API_ENDPOINTS.generateOutfits, f);
  }
}

const apiService = new APIService();
export default apiService;
