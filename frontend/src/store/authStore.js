import { create } from 'zustand';
import apiService from '../services/api.service';
import useOutfitStore from './outfitStore';
import useWardrobeStore from './wardrobeStore';

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
        // Auth decision is based on token *presence* only — never on a flag
        // like `requires_otp`, which a man-in-the-middle could flip in the
        // response. A token cannot be forged client-side because it must be
        // signed by the server's JWT secret.
        const { token, refresh_token, ...userData } = response.data;
        if (!token) {
          set({ isLoading: false });
          return { success: true, requires_otp: true, email: response.data.email };
        }

        localStorage.setItem('token', token);
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

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
   * Standard Register — backend sends OTP to email
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
   * Verify registration OTP — returns JWT on success
   */
  verifyEmail: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.verifyEmail(email, code);
      set({ isLoading: false });
      return { success: true, message: response.message };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  /**
   * Verify login OTP — returns JWT and signs user in
   */
  verifyLogin: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.verifyLogin(email, code);
      if (response.success && response.data) {
        const { token, refresh_token, ...userData } = response.data;
        localStorage.setItem('token', token);
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
        set({ user: userData, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      throw new Error('Verification failed');
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  /**
   * Resend OTP code
   */
  resendCode: async (email, purpose) => {
    try {
      await apiService.resendCode(email, purpose);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
      // Clear other stores to prevent data leakage between accounts
      useOutfitStore.getState().clearGenerated();
      useOutfitStore.setState({ outfits: [] });
      useWardrobeStore.getState().clearItems();
      set({ isLoading: false });
    }
  },

  /**
   * Global Auth Cleanup
   */
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  updateAvatar: async (file) => {
    const response = await apiService.updateAvatar(file);
    const { avatar_url } = response.data;
    set((state) => ({ user: { ...state.user, avatar_url } }));
    return avatar_url;
  },

  deleteAvatar: async () => {
    await apiService.deleteAvatar();
    set((state) => ({ user: { ...state.user, avatar_url: null } }));
  },

  clearError: () => set({ error: null })
}));

export default useAuthStore;
