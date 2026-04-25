import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import apiService from '../../services/api.service';
import { palette } from '../../theme/colors';
import { authStyles } from './authStyles';

const INVALID_LINK_TEXT = 'Password reset link has expired or is invalid. Please request a new password reset.';

const parseResetToken = (value) => {
  const trimmed = value?.trim?.() || '';
  if (!trimmed) return '';

  const tokenMatch = trimmed.match(/[?&]token=([^&]+)/i);
  if (tokenMatch?.[1]) {
    try {
      return decodeURIComponent(tokenMatch[1]);
    } catch (_e) {
      return tokenMatch[1];
    }
  }

  return trimmed;
};

const validatePassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must not exceed 128 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit';
  if (!/[!@#$%^&*()_+\-=[\]{}|;:',.<>?/~`]/.test(password)) return 'Password must contain at least one special character';
  return '';
};

export default function ResetPasswordScreen({ navigation, route }) {
  const tokenFromRoute = parseResetToken(route?.params?.token || '');
  const [token, setToken] = useState(tokenFromRoute);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [invalidLink, setInvalidLink] = useState(false);

  const onSubmit = async () => {
    if (isLoading) return;
    const errors = {};

    if (!token.trim()) errors.token = 'Reset token is required';
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) errors.newPassword = pwdErr;
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsLoading(true);
    try {
      const res = await apiService.resetPassword({
        token: parseResetToken(token),
        newPassword,
        confirmPassword,
      });
      setSuccessMessage(res?.message || 'Password reset successful! Please log in with your new password.');
    } catch (e) {
      const msg = e?.message || 'Password reset failed';
      const lower = msg.toLowerCase();
      if (lower.includes('invalid') || lower.includes('expired')) {
        setInvalidLink(true);
      }
      const backendField = e?.data?.error?.field;
      if (backendField === 'new_password') setFieldErrors((p) => ({ ...p, newPassword: msg }));
      else if (backendField === 'confirm_password') setFieldErrors((p) => ({ ...p, confirmPassword: msg }));
      else if (!lower.includes('invalid') && !lower.includes('expired')) setFieldErrors((p) => ({ ...p, form: msg }));
    } finally {
      setIsLoading(false);
    }
  };

  if (invalidLink) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
        <View style={authStyles.card}>
          <Text style={{ color: palette.danger, textAlign: 'center', lineHeight: 22 }}>{INVALID_LINK_TEXT}</Text>
        </View>
        <Pressable
          onPress={() => navigation.replace('ForgotPassword')}
          style={authStyles.button}
        >
          <Text style={authStyles.buttonText}>Request New Reset Link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
      <View style={authStyles.titleWrap}>
        <Text style={authStyles.title}>Create New Password</Text>
      </View>

      {successMessage ? (
        <>
          <View style={authStyles.card}>
            <Text style={{ color: palette.text, textAlign: 'center', lineHeight: 22 }}>{successMessage}</Text>
          </View>
          <Pressable
            onPress={() => navigation.replace('Login')}
            style={authStyles.button}
          >
            <Text style={authStyles.buttonText}>Return to Login</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={authStyles.helperText}>
            Paste the full reset link from your email or just the reset token below.
          </Text>

          <Text style={authStyles.label}>Reset Token</Text>
          <TextInput
            value={token}
            onChangeText={(v) => {
              setToken(parseResetToken(v));
              if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: undefined }));
            }}
            autoCapitalize="none"
            editable={!isLoading}
            placeholder="Paste reset link or token"
            placeholderTextColor={palette.textMuted}
            style={{ ...authStyles.input, borderColor: fieldErrors.token ? palette.danger : palette.borderStrong }}
          />
          {fieldErrors.token ? <Text style={authStyles.errorText}>{fieldErrors.token}</Text> : null}

          <Text style={authStyles.label}>New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              if (fieldErrors.newPassword) setFieldErrors((p) => ({ ...p, newPassword: undefined }));
            }}
            secureTextEntry
            maxLength={128}
            editable={!isLoading}
            placeholderTextColor={palette.textMuted}
            style={{ ...authStyles.input, borderColor: fieldErrors.newPassword ? palette.danger : palette.borderStrong }}
          />
          {fieldErrors.newPassword ? <Text style={authStyles.errorText}>{fieldErrors.newPassword}</Text> : null}

          <Text style={authStyles.label}>Confirm New Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            secureTextEntry
            maxLength={128}
            editable={!isLoading}
            placeholderTextColor={palette.textMuted}
            style={{ ...authStyles.input, borderColor: fieldErrors.confirmPassword ? palette.danger : palette.borderStrong }}
          />
          {fieldErrors.confirmPassword ? <Text style={authStyles.errorText}>{fieldErrors.confirmPassword}</Text> : null}
          {fieldErrors.form ? <Text style={authStyles.errorText}>{fieldErrors.form}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={isLoading}
            style={authStyles.button}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.buttonText}>Reset Password</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}
