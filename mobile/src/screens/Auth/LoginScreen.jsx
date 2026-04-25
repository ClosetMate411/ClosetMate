import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';
import { authStyles } from './authStyles';

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
    const nextStep = String(result?.next || '').toLowerCase();
    const shouldGoToVerify =
      result?.success &&
      (result?.requiresOtp || nextStep === 'verify_login' || nextStep.includes('verify'));

    if (shouldGoToVerify) {
      setPassword('');
      navigation.replace('VerifyLogin', {
        email: result.email || email,
        expiresInSeconds: result.expiresInSeconds,
      });
      return;
    }
    if (!result?.success) setPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center', gap: 12 }}
      >
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
                source={require('../../../assets/images/ClosetMate_Logo_new.png')}
                contentFit="contain"
                style={{ width: '100%', height: 120 }}
              />
            </View>
          </View>
          <Text style={[authStyles.title, { marginTop: 10 }]}>Login</Text>
        </View>

        <Text style={authStyles.label}>Email Address</Text>
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
          style={authStyles.input}
        />

        <Text style={authStyles.label}>Password</Text>
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
          style={authStyles.input}
        />

        {error ? <Text style={authStyles.errorText}>{mapLoginErrorMessage(error)}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={isLoading}
          style={authStyles.button}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.buttonText}>Login</Text>}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={authStyles.secondaryLink}>
          <Text style={authStyles.secondaryLinkText}>Forgot Password?</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Register')} style={authStyles.secondaryLink}>
          <Text style={authStyles.secondaryLinkText}>{"Don't have an account? Register"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
