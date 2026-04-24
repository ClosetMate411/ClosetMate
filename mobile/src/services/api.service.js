import axios from 'axios';
import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
} from '../store/tokenStore';

const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── REFRESH-TOKEN STATE ──────────────────────────────────────────────────
// Single-flight refresh: if N concurrent requests hit 401, only ONE
// /auth/refresh is issued and the rest await this promise. Matches the web
// client's axios interceptor so mobile session behaviour is identical.
let refreshInFlight = null;

const REFRESH_EXEMPT_PATHS = [
  API_ENDPOINTS.refresh,
  API_ENDPOINTS.login,
  API_ENDPOINTS.register,
  API_ENDPOINTS.verifyLogin,
  API_ENDPOINTS.verifyRegistration,
  API_ENDPOINTS.resendCode,
  API_ENDPOINTS.forgotPassword,
  API_ENDPOINTS.resetPassword,
];

const urlIsRefreshExempt = (url = '') => REFRESH_EXEMPT_PATHS.some((p) => url.includes(p));

const performRefresh = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const resp = await axios.post(
    `${API_CONFIG.baseURL}${API_ENDPOINTS.refresh}`,
    { refresh_token: refreshToken },
    { timeout: 15000, headers: { Accept: 'application/json' } },
  );
  const payload = resp.data?.data || resp.data || {};
  const newAccess = payload.token;
  const newRefresh = payload.refresh_token;
  if (!newAccess) throw new Error('Refresh response missing access token');

  await setAccessToken(newAccess);
  if (newRefresh) await setRefreshToken(newRefresh);
  return newAccess;
};

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
  async (error) => {
    if (error?.code === 'ERR_CANCELED') {
      throw new Error('Upload cancelled.');
    }

    const status = error.response?.status;
    const errorData = error.response?.data;
    const originalRequest = error.config || {};
    const requestUrl = originalRequest.url || '';

    // Silently refresh on 401 before giving up. Auth endpoints are exempt so
    // a genuine "bad credentials" doesn't loop through the refresh flow.
    if (
      status === 401 &&
      !originalRequest._retriedAfterRefresh &&
      !urlIsRefreshExempt(requestUrl)
    ) {
      const storedRefresh = await getRefreshToken();
      if (storedRefresh) {
        try {
          if (!refreshInFlight) {
            refreshInFlight = performRefresh().finally(() => {
              refreshInFlight = null;
            });
          }
          const newAccess = await refreshInFlight;
          originalRequest._retriedAfterRefresh = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return axiosInstance(originalRequest);
        } catch (_refreshErr) {
          // Refresh failed → treat as session expired, fall through
          await clearTokens();
        }
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

  async verifyLogin(data) {
    return axiosInstance.post(API_ENDPOINTS.verifyLogin, {
      email: data.email,
      code: data.code,
    });
  }

  async resendCode(data) {
    return axiosInstance.post(API_ENDPOINTS.resendCode, {
      email: data.email,
      purpose: data.purpose,
    });
  }

  async verifyRegistration(data) {
    return axiosInstance.post(API_ENDPOINTS.verifyRegistration, {
      email: data.email,
      code: data.code,
    });
  }

  async logout() {
    const refresh_token = await getRefreshToken().catch(() => null);
    return axiosInstance.post(
      API_ENDPOINTS.logout,
      refresh_token ? { refresh_token } : {},
    );
  }
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

  async toggleFavoriteOutfit(id) {
    return axiosInstance.put(API_ENDPOINTS.favoriteOutfit(id));
  }

  async generateOutfits(filters = {}) {
    const f = new FormData();
    f.append('count', String(filters.count ?? 3));
    f.append('season', filters.season ?? 'all');
    f.append('occasion', filters.occasion ?? 'everyday');
    f.append('style', filters.style ?? 'any');
    return axiosInstance.post(API_ENDPOINTS.generateOutfits, f, {
      timeout: 90000,
    });
  }

  // Community
  async getCommunityFeed(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityFeed, { params: { page, limit } });
  }

  async shareOutfit(outfitId) {
    return axiosInstance.post(API_ENDPOINTS.communityShare, { outfit_id: outfitId });
  }

  async addReaction(shareId, emojiType) {
    return axiosInstance.post(API_ENDPOINTS.communityReact(shareId), { emoji_type: emojiType });
  }

  async rateOutfit(shareId, score) {
    return axiosInstance.post(API_ENDPOINTS.communityRate(shareId), { score });
  }

  async getComments(shareId) {
    return axiosInstance.get(API_ENDPOINTS.communityComments(shareId));
  }

  async addComment(shareId, text) {
    return axiosInstance.post(API_ENDPOINTS.communityComments(shareId), { text });
  }

  async deleteComment(commentId) {
    return axiosInstance.delete(API_ENDPOINTS.communityDeleteComment(commentId));
  }
}

const apiService = new APIService();
export default apiService;
