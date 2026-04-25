import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import useAuthStore from '../store/authStore';
import { Home, Wardrobe, Outfits, Community, Profile, Login, Register, ForgotPassword, ResetPassword, VerifyLogin, VerifySignup, Logout } from '../screens';
import CustomDrawerContent from './CustomDrawerContent';
import { palette } from '../theme/colors';
import { motion, shadow } from '../theme/tokens';
import { onSessionExpired } from '../utils/sessionEvents';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const FullScreenLoader = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
    <ActivityIndicator size="large" color={palette.primary} />
  </View>
);

function MainDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      backBehavior="history"
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: palette.surfaceElevated,
          borderBottomWidth: 1,
          borderBottomColor: palette.borderSubtle,
        },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerLeft: () => null,
        headerTitle: () => (
          <Pressable onPress={() => navigation.navigate('Home')} hitSlop={8}>
            <ExpoImage
              source={require('../../assets/images/ClosetMate_Logo_new.png')}
              contentFit="contain"
              style={{ width: 215, height: 52, marginLeft: -18 }}
            />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable onPress={() => navigation.openDrawer()} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="menu" size={30} color="#6b7280" />
          </Pressable>
        ),
        drawerPosition: 'right',
        drawerType: 'front',
        overlayColor: palette.overlay,
        swipeEdgeWidth: 36,
        sceneStyle: { backgroundColor: palette.background },
        drawerStyle: {
          width: 326,
          backgroundColor: palette.surfaceElevated,
          borderLeftWidth: 0,
          ...shadow.card,
        },
        animationDuration: motion.standard,
      })}
    >
      <Drawer.Screen name="Home" component={Home} />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="Wardrobe" component={Wardrobe} />
      <Drawer.Screen name="Community" component={Community} />
      <Drawer.Screen name="Outfits" component={Outfits} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const init = useAuthStore((s) => s.init);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      clearAuth();
    });
    return unsubscribe;
  }, [clearAuth]);

  if (!isInitialized) return <FullScreenLoader />;

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator
          key="auth"
          screenOptions={{
            contentStyle: { backgroundColor: palette.background },
            animation: 'slide_from_right',
            animationDuration: motion.standard,
          }}
        >
          <Stack.Screen name="MainDrawer" component={MainDrawerNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="Logout"
            component={Logout}
            options={{
              presentation: 'modal',
              title: 'Logout',
              headerStyle: { backgroundColor: palette.surface },
              headerTitleStyle: { color: palette.text, fontWeight: '700' },
              headerTintColor: palette.primaryStrong,
            }}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          key="guest"
          screenOptions={{
            contentStyle: { backgroundColor: palette.background },
            animation: 'slide_from_right',
            animationDuration: motion.standard,
          }}
        >
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
