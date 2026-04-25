import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import apiService from '../../services/api.service';
import { palette } from '../../theme/colors';
import { authStyles } from './authStyles';

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
      <View style={authStyles.titleWrap}>
        <Text style={authStyles.title}>Reset Password</Text>
      </View>

      {!isSubmitted ? (
        <>
          <Text style={authStyles.helperText}>
            Enter your email address and click &quot;Send Reset Link&quot;.
          </Text>

          <Text style={authStyles.label}>Email Address</Text>
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
              ...authStyles.input,
              borderColor: fieldError ? palette.danger : palette.borderStrong,
            }}
          />
          {fieldError ? <Text style={authStyles.errorText}>{fieldError}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={isLoading}
            style={authStyles.button}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.buttonText}>Send Reset Link</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <View style={authStyles.card}>
            <Text style={{ color: palette.text, textAlign: 'center', lineHeight: 22 }}>{SUCCESS_TEXT}</Text>
            <Text style={{ color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>
              If the website link in the email does not open, copy the full reset link and paste it into the reset form in the app.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.replace('ResetPassword')}
            style={authStyles.button}
          >
            <Text style={authStyles.buttonText}>Open Reset Form</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => navigation.replace('Login')} style={authStyles.secondaryLink}>
        <Text style={authStyles.secondaryLinkText}>Return to Login</Text>
      </Pressable>
    </View>
  );
}
