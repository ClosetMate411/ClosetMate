import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';
import { authStyles } from './authStyles';

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
                <View style={authStyles.titleWrap}>
                    <Text style={authStyles.title}>Verify Your Email</Text>
                    <Text style={authStyles.helperText}>
                        We sent a 6-digit verification code to {email}. Enter it below to activate your account.
                    </Text>
                </View>

                <Text style={authStyles.label}>Verification Code</Text>
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
                        ...authStyles.input,
                        borderColor: palette.borderStrong,
                        letterSpacing: 8,
                        textAlign: 'center',
                        fontSize: 22,
                        fontWeight: '700',
                    }}
                />

                {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

                <Pressable
                    onPress={onSubmit}
                    disabled={isLoading}
                    style={authStyles.button}
                >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.buttonText}>Confirm</Text>}
                </Pressable>

                <Pressable onPress={onResend} disabled={isLoading} style={authStyles.secondaryLink}>
                    <Text style={authStyles.secondaryLinkText}>Resend Code</Text>
                </Pressable>

                <Pressable onPress={() => navigation.replace('Register')} disabled={isLoading} style={authStyles.secondaryLink}>
                    <Text style={authStyles.secondaryLinkText}>Back to Signup</Text>
                </Pressable>
            </View>
        </TouchableWithoutFeedback>
    );
}
