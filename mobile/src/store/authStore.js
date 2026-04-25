import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api.service';
import useWardrobeStore from './wardrobeStore';

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

const extractRefreshToken = (response) => {
  const payload = response?.data || response;
  return (
    payload?.refresh_token ||
    payload?.refreshToken ||
    payload?.data?.refresh_token ||
    payload?.data?.refreshToken ||
    null
  );
};

const extractOtpRequirement = (response) => {
  const payload = response?.data || response || {};
  const nested = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  const explicitFlag =
    payload?.requires_otp ??
    payload?.requiresOtp ??
    payload?.requires_2fa ??
    payload?.requires2fa ??
    payload?.needs_verification ??
    nested?.requires_otp ??
    nested?.requiresOtp ??
    nested?.requires_2fa ??
    nested?.requires2fa ??
    nested?.needs_verification;

  if (typeof explicitFlag === 'boolean') return explicitFlag;

  const candidateValues = [
    payload?.next,
    payload?.next_step,
    payload?.nextStep,
    payload?.step,
    payload?.action,
    payload?.status,
    payload?.code,
    payload?.error?.code,
    nested?.next,
    nested?.next_step,
    nested?.nextStep,
    nested?.step,
    nested?.action,
    nested?.status,
    nested?.code,
    nested?.error?.code,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const otpStateHints = [
    'verify_login',
    'verify-login',
    'login_verification_required',
    'verification_required',
    'otp_required',
    'mfa_required',
    '2fa_required',
    'two_factor_required',
    'requires_verification',
    'requires_otp',
    'pending_verification',
  ];

  if (candidateValues.some((value) => otpStateHints.some((hint) => value.includes(hint)))) {
    return true;
  }

  const message = String(payload?.message || nested?.message || '').toLowerCase();
  const otpHints = [
    'verification code',
    'verification required',
    'verify',
    'otp',
    'one-time password',
    'security code',
    '2fa',
    'mfa',
    'two-factor',
    'code sent',
    'doğrulama',
    'kod',
  ];
  return otpHints.some((hint) => message.includes(hint));
};

const extractOtpMeta = (response, fallbackEmail) => {
  const payload = response?.data || response || {};
  const nested = payload?.data && typeof payload.data === 'object' ? payload.data : {};

  return {
    email: payload?.email || nested?.email || fallbackEmail,
    expiresInSeconds:
      payload?.otp_expires_in_seconds ||
      payload?.expires_in_seconds ||
      nested?.otp_expires_in_seconds ||
      nested?.expires_in_seconds,
    message: payload?.message || nested?.message,
  };
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  init: async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, user: null, isInitialized: true });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        set({ user: response.data, isAuthenticated: true, isLoading: false, isInitialized: true });
      } else {
        get().clearAuth();
        set({ isLoading: false, isInitialized: true });
      }
    } catch (_e) {
      get().clearAuth();
      set({ isLoading: false, isInitialized: true });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login(credentials);
      if (response?.success === false) {
        if (extractOtpRequirement(response)) {
          const otpMeta = extractOtpMeta(response, credentials.email);
          set({ isLoading: false, error: null });
          return {
            success: true,
            next: 'verify_login',
            requiresOtp: true,
            email: otpMeta.email,
            message: otpMeta.message,
            expiresInSeconds: otpMeta.expiresInSeconds,
          };
        }
        throw new Error(response?.message || 'Login failed');
      }
      if (response?.success) {
        if (__DEV__) {
          console.log('[authStore.login] response =', JSON.stringify(response, null, 2));
        }
        if (extractOtpRequirement(response)) {
          const otpMeta = extractOtpMeta(response, credentials.email);
          set({ isLoading: false });
          return {
            success: true,
            next: 'verify_login',
            requiresOtp: true,
            email: otpMeta.email,
            message: otpMeta.message,
            expiresInSeconds: otpMeta.expiresInSeconds,
          };
        }

        const { token, user } = extractAuthPayload(response);
        const refreshToken = extractRefreshToken(response);
        if (!token || typeof token !== 'string') {
          throw new Error('Login succeeded but no token was returned by the API.');
        }
        // Defensive clear for environments that may issue direct token on login.
        useWardrobeStore.getState().clearItems();
        await AsyncStorage.setItem('token', token);
        if (refreshToken) await AsyncStorage.setItem('refresh_token', refreshToken);
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true, next: 'authenticated' };
      }
      throw new Error('Login failed');
    } catch (error) {
      const responseLikeError = error?.data;
      if (extractOtpRequirement(responseLikeError) || extractOtpRequirement({ message: error?.message })) {
        const otpMeta = extractOtpMeta(responseLikeError, credentials.email);
        set({ isLoading: false, error: null });
        return {
          success: true,
          next: 'verify_login',
          requiresOtp: true,
          email: otpMeta.email,
          message: otpMeta.message,
          expiresInSeconds: otpMeta.expiresInSeconds,
        };
      }
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
      const refreshToken = extractRefreshToken(response);
      if (!response?.success || !token || typeof token !== 'string') {
        throw new Error(response?.message || 'Verification succeeded but no token was returned by the API.');
      }

      // Ensure previous session's wardrobe cache does not bleed into the new account.
      useWardrobeStore.getState().clearItems();
      await AsyncStorage.setItem('token', token);
      if (refreshToken) await AsyncStorage.setItem('refresh_token', refreshToken);
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
    await AsyncStorage.removeItem('refresh_token');
    useWardrobeStore.getState().clearItems();
    set({ user: null, isAuthenticated: false, error: null });
  },

  setAvatarUrl: (avatarUrl) => {
    set((state) => {
      if (!state.user || typeof state.user !== 'object') return state;
      if (state.user.user && typeof state.user.user === 'object') {
        return {
          ...state,
          user: {
            ...state.user,
            avatar_url: avatarUrl,
            user: { ...state.user.user, avatar_url: avatarUrl },
          },
        };
      }
      return { ...state, user: { ...state.user, avatar_url: avatarUrl } };
    });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
