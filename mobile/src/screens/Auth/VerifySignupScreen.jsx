import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';

export default function VerifySignupScreen({ navigation, route }) {
    const verifyRegistration = useAuthStore((s) => s.verifyRegistration);
    const resendRegistrationCode = useAuthStore((s) => s.resendRegistrationCode);
    const isLoading = useAuthStore((s) => s.isLoading);
    const error = useAuthStore((s) => s.error);
    const clearError = useAuthStore((s) => s.clearError);

    const email = route?.params?.email || '';
    const [code, setCode] = useState('');

    const onSubmit = async () => {
        if (isLoading) return;
        clearError();

        const cleanedCode = code.replace(/\D/g, '');
        if (cleanedCode.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter the 6-digit verification code from your email.');
            return;
        }

        const result = await verifyRegistration({ email, code: cleanedCode });
        if (result.success) {
            navigation.replace('Login', {
                email,
                message: result.message || 'Email verified! You can now log in.',
            });
        } else {
            setCode('');
        }
    };

    const onResend = async () => {
        if (isLoading) return;
        clearError();
        const result = await resendRegistrationCode(email);
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
                    <Text style={{ fontSize: 28, fontWeight: '700', color: palette.text }}>Verify Your Email</Text>
                    <Text style={{ color: palette.textMuted, textAlign: 'center', lineHeight: 22 }}>
                        We sent a 6-digit verification code to {email}. Enter it below to activate your account.
                    </Text>
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
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Confirm</Text>}
                </Pressable>

                <Pressable onPress={onResend} disabled={isLoading} style={{ alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Resend Code</Text>
                </Pressable>

                <Pressable onPress={() => navigation.replace('Register')} disabled={isLoading} style={{ alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Back to Signup</Text>
                </Pressable>
            </View>
        </TouchableWithoutFeedback>
    );
}
