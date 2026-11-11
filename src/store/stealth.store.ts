import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './auth.store';

const BASE_STORAGE_KEY = 'centinel_hidden_reports_until_v1';

function getUserStealthKey(): string {
  const { user, profile } = useAuthStore.getState();
  const uid = user?.id || profile?.id;
  return uid ? `${BASE_STORAGE_KEY}_${uid}` : BASE_STORAGE_KEY;
}

interface StealthState {
  hiddenUntil: number | null; // timestamp en milisegundos
  isStealthActive: boolean;
  loadStealthMode: () => Promise<boolean>;
  setStealthHours: (hours: number) => Promise<void>;
  checkIfActive: () => boolean;
}

async function getStorageItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Fallo silencioso en storage
  }
}

async function deleteStorageItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Fallo silencioso en storage
  }
}

export const useStealthStore = create<StealthState>((set, get) => ({
  hiddenUntil: null,
  isStealthActive: false,

  checkIfActive: () => {
    const until = get().hiddenUntil;
    if (!until) return false;
    const now = Date.now();
    const active = now < until;
    if (!active && get().isStealthActive) {
      set({ isStealthActive: false, hiddenUntil: null });
      deleteStorageItem(getUserStealthKey());
    }
    return active;
  },

  loadStealthMode: async () => {
    const storageKey = getUserStealthKey();
    const raw = await getStorageItem(storageKey);
    if (raw) {
      const until = parseInt(raw, 10);
      if (!isNaN(until)) {
        const now = Date.now();
        if (now < until) {
          set({ hiddenUntil: until, isStealthActive: true });
          return true;
        } else {
          await deleteStorageItem(storageKey);
        }
      }
    }
    set({ hiddenUntil: null, isStealthActive: false });
    return false;
  },

  setStealthHours: async (hours: number) => {
    const until = Date.now() + hours * 60 * 60 * 1000;
    set({ hiddenUntil: until, isStealthActive: true });
    await setStorageItem(getUserStealthKey(), until.toString());
  },
}));
