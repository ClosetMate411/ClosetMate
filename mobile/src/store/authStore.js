import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api.service';

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
        const { token, ...userData } = response.data;
        await AsyncStorage.setItem('token', token);
        set({ user: userData, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      throw new Error('Login failed');
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

  logout: async () => {
    set({ isLoading: true });
    try { await apiService.logout(); } catch (_e) {}
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
