import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import apiService from '../../services/api.service';
import { palette } from '../../theme/colors';

const INVALID_LINK_TEXT = 'Password reset link has expired or is invalid. Please request a new password reset.';

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
  const tokenFromRoute = route?.params?.token || '';
  const [token, setToken] = useState(tokenFromRoute);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [invalidLink, setInvalidLink] = useState(false);

  const tokenMissing = useMemo(() => !token?.trim(), [token]);

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
        token: token.trim(),
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

  if (invalidLink || (tokenMissing && !successMessage)) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
        <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.danger, textAlign: 'center', lineHeight: 22 }}>{INVALID_LINK_TEXT}</Text>
        </View>
        <Pressable
          onPress={() => navigation.replace('ForgotPassword')}
          style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
        >
          <Text style={{ fontWeight: '700', color: '#fff' }}>Request New Reset Link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.text }}>Create New Password</Text>
      </View>

      {successMessage ? (
        <>
          <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, backgroundColor: palette.surface }}>
            <Text style={{ color: palette.text, textAlign: 'center', lineHeight: 22 }}>{successMessage}</Text>
          </View>
          <Pressable
            onPress={() => navigation.replace('Login')}
            style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
          >
            <Text style={{ fontWeight: '700', color: '#fff' }}>Return to Login</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: palette.text, fontWeight: '600' }}>Reset Token</Text>
          <TextInput
            value={token}
            onChangeText={(v) => {
              setToken(v);
              if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: undefined }));
            }}
            autoCapitalize="none"
            editable={!isLoading}
            placeholderTextColor={palette.textMuted}
            style={{ borderWidth: 1, borderColor: fieldErrors.token ? palette.danger : palette.borderStrong, padding: 12, borderRadius: 10, backgroundColor: palette.surface, color: palette.text }}
          />
          {fieldErrors.token ? <Text style={{ color: palette.danger }}>{fieldErrors.token}</Text> : null}

          <Text style={{ color: palette.text, fontWeight: '600' }}>New Password</Text>
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
            style={{ borderWidth: 1, borderColor: fieldErrors.newPassword ? palette.danger : palette.borderStrong, padding: 12, borderRadius: 10, backgroundColor: palette.surface, color: palette.text }}
          />
          {fieldErrors.newPassword ? <Text style={{ color: palette.danger }}>{fieldErrors.newPassword}</Text> : null}

          <Text style={{ color: palette.text, fontWeight: '600' }}>Confirm New Password</Text>
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
            style={{ borderWidth: 1, borderColor: fieldErrors.confirmPassword ? palette.danger : palette.borderStrong, padding: 12, borderRadius: 10, backgroundColor: palette.surface, color: palette.text }}
          />
          {fieldErrors.confirmPassword ? <Text style={{ color: palette.danger }}>{fieldErrors.confirmPassword}</Text> : null}
          {fieldErrors.form ? <Text style={{ color: palette.danger }}>{fieldErrors.form}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={isLoading}
            style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Reset Password</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

