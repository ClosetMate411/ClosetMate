import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api.service';

const extractAuthPayload = (response) => {
  const payload = response?.data || response;
  const token =
    payload?.token ||
    payload?.accessToken ||
    payload?.access_token ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.access_token;

  const user =
    payload?.user ||
    payload?.data?.user ||
    (payload && typeof payload === 'object' ? payload : null);

  return { token, user };
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  init: async () => {
    const token = await AsyncStorage.getItem('token');
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
        if (response.data.requires_otp) {
          set({ isLoading: false });
          return {
            success: true,
            requiresOtp: true,
            email: response.data.email || credentials.email,
            message: response.message,
            expiresInSeconds: response.data.otp_expires_in_seconds,
          };
        }

        const { token, user } = extractAuthPayload(response);
        if (!token || typeof token !== 'string') {
          throw new Error('Login succeeded but no token was returned by the API.');
        }
        await AsyncStorage.setItem('token', token);
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

      const { token, user } = extractAuthPayload(response);
      if (!response?.success || !token || typeof token !== 'string') {
        throw new Error(response?.message || 'Verification succeeded but no token was returned by the API.');
      }

      await AsyncStorage.setItem('token', token);
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
    await AsyncStorage.removeItem('token');
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
