import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import useAuthStore from '../../store/authStore';
import { palette } from '../../theme/colors';

export default function LogoutScreen({ navigation }) {
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    (async () => {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    })();
  }, [logout, navigation]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 28 }}>👋</Text>
      <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text }}>Logging out...</Text>
      <ActivityIndicator color={palette.primary} />
    </View>
  );
}
