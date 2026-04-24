import { create } from 'zustand';
import apiService from '../services/api.service';
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from './tokenStore';

const extractAuthPayload = (response) => {
  const payload = response?.data || response;
  const token =
    payload?.token ||
    payload?.accessToken ||
    payload?.access_token ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.access_token;

  const refreshToken =
    payload?.refresh_token ||
    payload?.refreshToken ||
    payload?.data?.refresh_token ||
    payload?.data?.refreshToken;

  const user =
    payload?.user ||
    payload?.data?.user ||
    (payload && typeof payload === 'object' ? payload : null);

  return { token, refreshToken, user };
};

const persistTokens = async (token, refreshToken) => {
  await setAccessToken(token);
  if (refreshToken) await setRefreshToken(refreshToken);
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  init: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, user: null });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        set({ user: response.data, isAuthenticated: true, isLoading: false });
      } else {
        get().clearAuth();
        set({ isLoading: false });
      }
    } catch (_e) {
      get().clearAuth();
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login(credentials);
      if (response.success && response.data) {
        if (__DEV__) {
          console.log('[authStore.login] response =', JSON.stringify(response, null, 2));
        }
        // Auth decision is driven by token *presence* only — never by a flag
        // like `requires_otp`, which a man-in-the-middle could flip in the
        // response. A token cannot be forged client-side because it must be
        // signed by the server's JWT secret.
        const { token, refreshToken, user } = extractAuthPayload(response);
        if (!token || typeof token !== 'string') {
          set({ isLoading: false });
          return {
            success: true,
            requiresOtp: true,
            email: response.data.email || credentials.email,
            message: response.message,
            expiresInSeconds: response.data.otp_expires_in_seconds,
          };
        }
        await persistTokens(token, refreshToken);
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      throw new Error('Login failed');
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  verifyLoginOtp: async ({ email, code }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.verifyLogin({ email, code });
      if (__DEV__) {
        console.log('[authStore.verifyLoginOtp] response =', JSON.stringify(response, null, 2));
      }

      const { token, refreshToken, user } = extractAuthPayload(response);
      if (!response?.success || !token || typeof token !== 'string') {
        throw new Error(response?.message || 'Verification succeeded but no token was returned by the API.');
      }

      await persistTokens(token, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  resendLoginOtp: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.resendCode({ email, purpose: 'login' });
      set({ isLoading: false });
      return { success: !!response?.success, message: response?.message };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.register(userData);
      set({ isLoading: false });
      return { success: true, message: response.message };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message, errors: error.data?.errors };
    }
  },

  verifyRegistration: async ({ email, code }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.verifyRegistration({ email, code });
      // Registration OTP may also return an access+refresh pair — persist if so.
      const { token, refreshToken } = extractAuthPayload(response);
      if (token && typeof token === 'string') {
        await persistTokens(token, refreshToken);
      }
      set({ isLoading: false });
      return { success: !!response?.success, message: response?.message || 'Email verified successfully!' };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  resendRegistrationCode: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.resendCode({ email, purpose: 'registration' });
      set({ isLoading: false });
      return { success: !!response?.success, message: response?.message };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try { await apiService.logout(); } catch (_e) { }
    finally {
      await get().clearAuth();
      set({ isLoading: false });
    }
  },

  clearAuth: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
