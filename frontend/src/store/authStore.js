import { create } from 'zustand';
import apiService from '../services/api.service';

/**
 * Auth Store with Explicit Token Management
 * Aligned with standard localStorage ['token'] testing
 */
const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  /**
   * Initialize session and fetch user profile
   */
  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        set({ 
          user: response.data, 
          isAuthenticated: true, 
          isLoading: false 
        });
      }
    } catch (error) {
      // If token is invalid/expired, wipe it
      get().clearAuth();
      set({ isLoading: false });
    }
  },

  /**
   * Login and set token explicitly
   */
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login(credentials);
      if (response.success && response.data) {
        const { token, ...userData } = response.data;
        
        // 1. Save to localStorage for external tests and persistence
        localStorage.setItem('token', token);
        
        // 2. Set memory state
        set({ 
          user: userData, 
          isAuthenticated: true, 
          isLoading: false 
        });
        return { success: true };
      }
      throw new Error('Login failed');
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  /**
   * Standard Register
   */
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.register(userData);
      set({ isLoading: false });
      return { success: true, message: response.message };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { 
        success: false, 
        error: error.message,
        errors: error.data?.errors 
      };
    }
  },

  /**
   * Logout and wipe token
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      await apiService.logout();
    } catch (e) {
      // Silent fail
    } finally {
      get().clearAuth();
      set({ isLoading: false });
    }
  },

  /**
   * Global Auth Cleanup
   */
  clearAuth: () => {
    localStorage.removeItem('token');
    set({ 
      user: null, 
      isAuthenticated: false,
      error: null 
    });
  },

  clearError: () => set({ error: null })
}));

export default useAuthStore;
