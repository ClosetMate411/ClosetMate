// Secure token storage wrapper.
//
// iOS → Keychain (hardware-backed when available), Android → EncryptedSharedPreferences
// backed by the Android Keystore. Root-level attackers can no longer read the
// JWT in plaintext — AppSec "token in AsyncStorage" finding closed.
//
// One-time legacy migration: if the user already has a JWT stored under the
// old AsyncStorage key, we move it into SecureStore on the first call and then
// wipe the AsyncStorage copy. Users don't get logged out after the upgrade.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const LEGACY_MIGRATION_FLAG = 'secure_store_migrated';

let migrationPromise = null;

const runLegacyMigration = async () => {
  try {
    const alreadyDone = await AsyncStorage.getItem(LEGACY_MIGRATION_FLAG);
    if (alreadyDone) return;
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacyToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    await AsyncStorage.setItem(LEGACY_MIGRATION_FLAG, '1');
  } catch (_e) {
    // Non-fatal — user can re-login if migration fails
  }
};

const ensureMigrated = () => {
  if (!migrationPromise) migrationPromise = runLegacyMigration();
  return migrationPromise;
};

export const getAccessToken = async () => {
  await ensureMigrated();
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const setAccessToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);

export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

export const setRefreshToken = (token) =>
  SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);

export const clearTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
};
