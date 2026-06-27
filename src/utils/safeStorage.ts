import AsyncStorage from '@react-native-async-storage/async-storage';

export async function safeSetItem(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`AsyncStorage.setItem failed for "${key}":`, e);
    return false;
  }
}

export async function safeRemoveItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`AsyncStorage.removeItem failed for "${key}":`, e);
    return false;
  }
}
