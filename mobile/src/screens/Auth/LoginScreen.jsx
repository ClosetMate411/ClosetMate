import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';

const mapLoginErrorMessage = (message) => {
  if (!message) return '';
  if (message.toLowerCase().includes('email service unavailable')) {
    return 'Verification email service is temporarily unavailable. Please try again in a minute.';
  }
  return message;
};

export default function LoginScreen({ navigation, route }) {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');

  const flashShown = useRef(false);
  const flashMessage = route?.params?.message;

  useEffect(() => {
    if (flashMessage && !flashShown.current) {
      flashShown.current = true;
      Alert.alert('Info', flashMessage);
      navigation.setParams({ message: undefined });
    }
  }, [flashMessage, navigation]);

  const onSubmit = async () => {
    if (isLoading) return;
    clearError();
    const result = await login({ email, password });
    if (result.success && result.requiresOtp) {
      setPassword('');
      navigation.replace('VerifyLogin', {
        email: result.email || email,
        expiresInSeconds: result.expiresInSeconds,
      });
      return;
    }
    if (!result.success) setPassword('');
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
      <View style={{ alignItems: 'center', marginBottom: 10, gap: 10 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 26,
            paddingHorizontal: 12,
            paddingVertical: 16,
            backgroundColor: palette.surfaceSoft,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <View
            style={{
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.7)',
              paddingVertical: 10,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <ExpoImage
              source={require('../../../assets/images/ClosetMate_Logo.svg')}
              contentFit="contain"
              style={{ width: '100%', height: 120 }}
            />
          </View>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', marginTop: 10, color: palette.text }}>Login</Text>
      </View>

      <Text style={{ color: palette.text, fontWeight: '600' }}>Email Address</Text>
      <TextInput
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) clearError();
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@example.com"
        editable={!isLoading}
        placeholderTextColor={palette.textMuted}
        style={{ borderWidth: 1, borderColor: palette.borderStrong, padding: 12, borderRadius: 10, backgroundColor: palette.surface, color: palette.text }}
      />

      <Text style={{ color: palette.text, fontWeight: '600' }}>Password</Text>
      <TextInput
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (error) clearError();
        }}
        secureTextEntry
        placeholder="••••••••"
        editable={!isLoading}
        placeholderTextColor={palette.textMuted}
        style={{ borderWidth: 1, borderColor: palette.borderStrong, padding: 12, borderRadius: 10, backgroundColor: palette.surface, color: palette.text }}
      />

      {error ? <Text style={{ color: palette.danger }}>{mapLoginErrorMessage(error)}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={isLoading}
        style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Login</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignItems: 'center', marginTop: 2 }}>
        <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Forgot Password?</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Register')} style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>{"Don't have an account? Register"}</Text>
      </Pressable>
    </View>
  );
}
