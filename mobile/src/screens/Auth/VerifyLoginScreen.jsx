import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';

export default function VerifyLoginScreen({ navigation, route }) {
  const verifyLoginOtp = useAuthStore((s) => s.verifyLoginOtp);
  const resendLoginOtp = useAuthStore((s) => s.resendLoginOtp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const email = route?.params?.email || '';
  const expiresInSeconds = route?.params?.expiresInSeconds;
  const [code, setCode] = useState('');

  const helperText = useMemo(() => {
    if (!expiresInSeconds) return `We sent a 6-digit verification code to ${email}.`;
    const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
    return `We sent a 6-digit verification code to ${email}. It expires in about ${minutes} minutes.`;
  }, [email, expiresInSeconds]);

  const onSubmit = async () => {
    if (isLoading) return;
    clearError();

    const cleanedCode = code.replace(/\D/g, '');
    if (cleanedCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code from your email.');
      return;
    }

    const result = await verifyLoginOtp({ email, code: cleanedCode });
    if (!result.success) {
      setCode('');
    }
  };

  const onResend = async () => {
    if (isLoading) return;
    clearError();
    const result = await resendLoginOtp(email);
    if (result.success) {
      Alert.alert('Code Sent', result.message || 'A new verification code was sent to your email.');
      return;
    }
    Alert.alert('Resend Failed', result.error || 'Could not resend the verification code.');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
        <View style={{ alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: palette.text }}>Verify Login</Text>
          <Text style={{ color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>{helperText}</Text>
        </View>

        <Text style={{ color: palette.text, fontWeight: '600' }}>Verification Code</Text>
        <TextInput
          value={code}
          onChangeText={(value) => {
            const nextCode = value.replace(/\D/g, '').slice(0, 6);
            setCode(nextCode);
            if (nextCode.length === 6) {
              Keyboard.dismiss();
            }
            if (error) clearError();
          }}
          keyboardType="number-pad"
          placeholder="_ _ _ _ _ _"
          editable={!isLoading}
          maxLength={6}
          placeholderTextColor={palette.textMuted}
          style={{
            borderWidth: 1,
            borderColor: palette.borderStrong,
            padding: 12,
            borderRadius: 10,
            backgroundColor: palette.surface,
            color: palette.text,
            letterSpacing: 8,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: '700',
          }}
        />

        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={isLoading}
          style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primary }}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Verify</Text>}
        </Pressable>

        <Pressable onPress={onResend} disabled={isLoading} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Resend Code</Text>
        </Pressable>

        <Pressable onPress={() => navigation.replace('Login', { email })} disabled={isLoading} style={{ alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Back to Login</Text>
        </Pressable>
      </View>
    </TouchableWithoutFeedback>
  );
}
