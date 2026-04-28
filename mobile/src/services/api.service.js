import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { API_CONFIG, API_ENDPOINTS } from '../config/api.config';
import { emitSessionExpired } from '../utils/sessionEvents';

const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

const SESSION_EXEMPT_PATHS = [
  API_ENDPOINTS.refresh,
  API_ENDPOINTS.login,
  API_ENDPOINTS.register,
  API_ENDPOINTS.verifyLogin,
  API_ENDPOINTS.verifyRegistration,
  API_ENDPOINTS.resendCode,
  API_ENDPOINTS.forgotPassword,
  API_ENDPOINTS.resetPassword,
];

const isSessionExemptUrl = (url = '') => SESSION_EXEMPT_PATHS.some((path) => String(url).includes(path));
let refreshInFlight = null;

let lastSessionExpiredEmitAt = 0;

const emitSessionExpiredSafely = (payload) => {
  const now = Date.now();
  if (now - lastSessionExpiredEmitAt < 3000) return;
  lastSessionExpiredEmitAt = now;
  emitSessionExpired(payload);
};

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
    }
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

const extractAccessToken = (payload) =>
  payload?.token ||
  payload?.access_token ||
  payload?.accessToken ||
  null;

const extractRefreshToken = (payload) =>
  payload?.refresh_token ||
  payload?.refreshToken ||
  null;

const performRefresh = async () => {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token available');

  // Use bare axios so refresh request itself is never intercepted/retried.
  const response = await axios.post(
    `${API_CONFIG.baseURL}${API_ENDPOINTS.refresh}`,
    { refresh_token: refreshToken },
    { timeout: 15000, headers: { Accept: 'application/json' } }
  );

  const payload = response?.data?.data || response?.data || {};
  const newAccess = extractAccessToken(payload);
  const newRefresh = extractRefreshToken(payload);

  if (!newAccess) throw new Error('Refresh response missing access token');

  await AsyncStorage.setItem('token', newAccess);
  if (newRefresh) await AsyncStorage.setItem('refresh_token', newRefresh);

  return newAccess;
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
    const originalRequest = error?.config || {};
    const requestUrl = originalRequest?.url || '';

    const hasRefreshToken = !!(await AsyncStorage.getItem('refresh_token'));
    const canTryRefresh =
      status === 401 &&
      !originalRequest?._retriedAfterRefresh &&
      !isSessionExemptUrl(requestUrl) &&
      hasRefreshToken;

    if (canTryRefresh) {
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
      } catch (_refreshError) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('refresh_token');
      }
    }

    // Global session expiry check
    if (status === 401 || status === 403) {
      const code = errorData?.error?.code || errorData?.code;
      // Don't wipe for login errors, only for expired sessions
      if (
        code !== 'INVALID_CREDENTIALS' &&
        code !== 'ACCOUNT_LOCKED' &&
        !isSessionExemptUrl(requestUrl)
      ) {
        emitSessionExpiredSafely({ status, code, requestUrl });
      }
    }

    if (error.response) {
      const message = extractErrorMessage(errorData) || `Error: ${status}`;
      const newError = new Error(message);
      newError.data = errorData;
      throw newError;
    }
    const baseMsg = error.message || 'Network error';
    const codeSuffix = error.code ? ` (${error.code})` : '';
    throw new Error(`${baseMsg}${codeSuffix}`);
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
    const refresh_token = await AsyncStorage.getItem('refresh_token');
    return axiosInstance.post(API_ENDPOINTS.logout, refresh_token ? { refresh_token } : {});
  }
  async getCurrentUser() { return axiosInstance.get(API_ENDPOINTS.me); }
  async updateAvatar(file) {
    const f = new FormData();
    f.append('avatar', file);
    return axiosInstance.put(API_ENDPOINTS.avatar, f, { timeout: 60000 });
  }
  async deleteAvatar() { return axiosInstance.delete(API_ENDPOINTS.avatar); }

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
    const token = await AsyncStorage.getItem('token');
    const url = `${API_CONFIG.baseURL}${API_ENDPOINTS.processImage}`;
    const task = FileSystemLegacy.createUploadTask(url, file.uri, {
      httpMethod: 'POST',
      uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType: file.type,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
      },
    });

    if (signal) {
      if (signal.aborted) {
        const err = new Error('Upload cancelled.');
        err.code = 'ERR_CANCELED';
        throw err;
      }
      const onAbort = () => { task.cancelAsync().catch(() => {}); };
      signal.addEventListener('abort', onAbort);
    }

    let result;
    try {
      result = await task.uploadAsync();
    } catch (e) {
      throw new Error(`${e?.message || 'Upload failed'} (UPLOAD_FAIL)`);
    }

    if (!result) {
      const err = new Error('Upload cancelled.');
      err.code = 'ERR_CANCELED';
      throw err;
    }

    let body;
    try { body = JSON.parse(result.body); } catch { body = { message: result.body }; }

    if (result.status >= 200 && result.status < 300) {
      if (body && body.success === false) {
        const msg = extractErrorMessage(body) || 'Operation failed';
        const err = new Error(msg);
        err.data = body;
        throw err;
      }
      return body;
    }

    const msg = extractErrorMessage(body) || `Error: ${result.status}`;
    const err = new Error(msg);
    err.data = body;
    throw err;
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

  async deleteOutfit(id) {
    return axiosInstance.delete(API_ENDPOINTS.outfit(id));
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

  async saveOutfit(outfitData) {
    return axiosInstance.post(API_ENDPOINTS.saveOutfit, outfitData);
  }

  async getWardrobeStats() {
    return axiosInstance.get(API_ENDPOINTS.wardrobeStats);
  }

  // Community
  async getCommunityFeed(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityFeed, { params: { page, limit } });
  }

  async getCommunityTopRated(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityTopRated, { params: { page, limit } });
  }

  async getTopRated(page = 1, limit = 20) {
    return this.getCommunityTopRated(page, limit);
  }

  async getCommunityFavorites(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityFavorites, { params: { page, limit } });
  }

  async getFavorites(page = 1, limit = 20) {
    return this.getCommunityFavorites(page, limit);
  }

  async getCommunityNotifications(page = 1, limit = 20) {
    return axiosInstance.get(API_ENDPOINTS.communityNotifications, { params: { page, limit } });
  }

  async getNotifications(page = 1, limit = 20) {
    return this.getCommunityNotifications(page, limit);
  }

  async markCommunityNotificationsRead() {
    return axiosInstance.put(API_ENDPOINTS.communityMarkNotificationsRead);
  }

  async markNotificationsRead() {
    return this.markCommunityNotificationsRead();
  }

  async searchUsers(query) {
    return axiosInstance.get(API_ENDPOINTS.communityUserSearch, { params: { q: query } });
  }
  
  async getUserProfile(userId) {
    return axiosInstance.get(API_ENDPOINTS.communityUserProfile(userId));
  }

  async shareOutfit(outfitId, description = null) {
    return axiosInstance.post(API_ENDPOINTS.communityShare, {
      outfit_id: outfitId,
      description: description ?? null,
    });
  }

  async unshareOutfit(sharedOutfitId) {
    return axiosInstance.delete(API_ENDPOINTS.communityUnshare(sharedOutfitId));
  }

  async toggleCommunityFavorite(shareId) {
    return axiosInstance.post(API_ENDPOINTS.communityToggleFavorite(shareId));
  }

  async toggleFavorite(sharedOutfitId) {
    return this.toggleCommunityFavorite(sharedOutfitId);
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

  async addComment(shareId, text, replyToCommentId = null) {
    return axiosInstance.post(API_ENDPOINTS.communityComments(shareId), {
      text,
      ...(replyToCommentId ? { reply_to_comment_id: replyToCommentId } : {}),
    });
  }

  async deleteComment(commentId) {
    return axiosInstance.delete(API_ENDPOINTS.communityDeleteComment(commentId));
  }
}

const apiService = new APIService();
export default apiService;
