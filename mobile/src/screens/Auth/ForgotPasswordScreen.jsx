import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import apiService from '../../services/api.service';
import { palette } from '../../theme/colors';

const SUCCESS_TEXT = 'If an account exists with that email address, you will receive a password reset link shortly.';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validateEmail = (value) => {
    if (!value) return 'Email is required';
    if (value.length > 254) return 'Email must not exceed 254 characters';
    return '';
  };

  const onSubmit = async () => {
    if (isLoading) return;
    const err = validateEmail(email.trim());
    setFieldError(err);
    if (err) return;

    setIsLoading(true);
    try {
      await apiService.forgotPassword(email.trim().toLowerCase());
      setIsSubmitted(true);
    } catch (_e) {
      // Prevent email enumeration: show same success message even on failure.
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.text }}>Reset Password</Text>
      </View>

      {!isSubmitted ? (
        <>
          <Text style={{ color: palette.textMuted, textAlign: 'center', marginBottom: 8 }}>
            Enter your email address and click &quot;Send Reset Link&quot;.
          </Text>

          <Text style={{ color: palette.text, fontWeight: '600' }}>Email Address</Text>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (fieldError) setFieldError('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            editable={!isLoading}
            maxLength={254}
            placeholderTextColor={palette.textMuted}
            style={{
              borderWidth: 1,
              borderColor: fieldError ? palette.danger : palette.borderStrong,
              padding: 12,
              borderRadius: 10,
              backgroundColor: palette.surface,
              color: palette.text,
            }}
          />
          {fieldError ? <Text style={{ color: palette.danger }}>{fieldError}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={isLoading}
            style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Send Reset Link</Text>}
          </Pressable>
        </>
      ) : (
        <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text, textAlign: 'center', lineHeight: 22 }}>{SUCCESS_TEXT}</Text>
        </View>
      )}

      <Pressable onPress={() => navigation.replace('Login')} style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Return to Login</Text>
      </Pressable>
    </View>
  );
}

