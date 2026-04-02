import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../store/authStore';
import { Home, Wardrobe, Outfits, Community, Login, Register, ForgotPassword, ResetPassword, VerifyLogin, VerifySignup, Logout } from '../screens';
import { palette } from '../theme/colors';

const Stack = createNativeStackNavigator();

const FullScreenLoader = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
    <ActivityIndicator size="large" color={palette.primary} />
  </View>
);

const LogoutHeaderButton = ({ navigation }) => (
  <Pressable onPress={() => navigation.navigate('Logout')} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
    <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Logout</Text>
  </Pressable>
);

export default function RootNavigator() {
  const init = useAuthStore((s) => s.init);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('token');
      setHasToken(!!t);
      await init();
    })();
  }, [init]);

  const isInitializing = useMemo(() => isLoading && !user && hasToken, [isLoading, user, hasToken]);
  if (isInitializing) return <FullScreenLoader />;

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator
          key="auth"
          screenOptions={({ navigation }) => ({
            headerRight: () => <LogoutHeaderButton navigation={navigation} />,
            headerStyle: { backgroundColor: palette.surface },
            headerTitleStyle: { color: palette.text, fontWeight: '700' },
            headerTintColor: palette.primaryStrong,
            contentStyle: { backgroundColor: palette.background },
          })}
        >
          <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
          <Stack.Screen name="Wardrobe" component={Wardrobe} />
          <Stack.Screen name="Outfits" component={Outfits} />
          <Stack.Screen name="Community" component={Community} />
          <Stack.Screen
            name="Logout"
            component={Logout}
            options={{ presentation: 'modal', title: 'Logout', headerRight: () => null }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator key="guest" screenOptions={{ contentStyle: { backgroundColor: palette.background } }}>
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={Register} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} options={{ headerShown: false }} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} options={{ headerShown: false }} />
          <Stack.Screen name="VerifyLogin" component={VerifyLogin} options={{ headerShown: false }} />
          <Stack.Screen name="VerifySignup" component={VerifySignup} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
