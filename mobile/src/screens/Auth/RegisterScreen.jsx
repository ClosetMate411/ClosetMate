import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';

export default function RegisterScreen({ navigation }) {
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const onSubmit = async () => {
    if (isLoading) return;
    setFieldErrors({});
    clearError();
    const result = await register({ fullName, email, password, confirmPassword });
    if (result.success) {
      navigation.replace('VerifySignup', { email });
    } else if (result.errors && Array.isArray(result.errors)) {
      const mapped = {};
      result.errors.forEach((err) => {
        if (!err.field) return;
        const field =
          err.field === 'full_name' ? 'fullName' :
            err.field === 'confirm_password' ? 'confirmPassword' :
              err.field;
        mapped[field] = err.message;
      });
      setFieldErrors(mapped);
      if (!Object.keys(mapped).length && result.error) {
        Alert.alert('Register Failed', result.error);
      }
    } else if (result.error) {
      Alert.alert('Register Failed', result.error);
    }
  };

  const Field = ({ label, value, setValue, secure, name, keyboardType, autoCapitalize }) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: palette.text, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => {
          setValue(t);
          if (fieldErrors[name]) setFieldErrors((p) => ({ ...p, [name]: undefined }));
          if (error) clearError();
        }}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={!isLoading}
        placeholderTextColor={palette.textMuted}
        style={{
          borderWidth: 1,
          borderColor: fieldErrors[name] ? palette.danger : palette.borderStrong,
          padding: 12,
          borderRadius: 10,
          backgroundColor: palette.surface,
          color: palette.text,
        }}
      />
      {fieldErrors[name] ? <Text style={{ color: palette.danger }}>{fieldErrors[name]}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12, backgroundColor: palette.background }}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginTop: 10, color: palette.text }}>Register</Text>
      </View>

      <Field label="Full Name" value={fullName} setValue={setFullName} name="fullName" autoCapitalize="words" />
      <Field label="Email Address" value={email} setValue={setEmail} name="email" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" value={password} setValue={setPassword} name="password" secure />
      <Field label="Confirm Password" value={confirmPassword} setValue={setConfirmPassword} name="confirmPassword" secure />

      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={isLoading}
        style={{ padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.primary, marginTop: 8, backgroundColor: palette.primary }}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Create Account</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.replace('Login')} style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Already have an account? Login</Text>
      </Pressable>
    </View>
  );
}
