import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './auth.store';

const BASE_STORAGE_KEY = 'centinel_seen_reports_v2';
const BASE_INITIALIZED_KEY = 'centinel_seen_reports_initialized_v2';

function getCurrentUserId(): string | null {
  const { user, profile } = useAuthStore.getState();
  return user?.id || profile?.id || null;
}

function getStorageKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_STORAGE_KEY}_${uid}` : BASE_STORAGE_KEY;
}

function getInitializedKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_INITIALIZED_KEY}_${uid}` : BASE_INITIALIZED_KEY;
}

interface ReportsState {
  openedReportIds: Set<string>;
  isInitialized: boolean;
  loadedUserId: string | null;
  markReportAsOpened: (id: string) => Promise<void>;
  setOpenedReportIds: (ids: Set<string>) => void;
  initializeSeenReports: (existingReportIds: string[]) => Promise<void>;
  isReportOpened: (id: string) => boolean;
  loadPersistedSeenReports: () => Promise<void>;
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

export const useReportsStore = create<ReportsState>((set, get) => ({
  openedReportIds: new Set<string>(),
  isInitialized: false,
  loadedUserId: null,

  loadPersistedSeenReports: async () => {
    const uid = getCurrentUserId();
    const isNewUser = get().loadedUserId !== uid;
    const raw = await getStorageItem(getStorageKey());
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          set((state) => ({
            openedReportIds: isNewUser ? new Set(arr) : new Set([...state.openedReportIds, ...arr]),
            loadedUserId: uid,
          }));
          return;
        }
      } catch {}
    }
    if (isNewUser) {
      set({ openedReportIds: new Set<string>(), isInitialized: false, loadedUserId: uid });
    }
  },

  initializeSeenReports: async (existingReportIds: string[]) => {
    const uid = getCurrentUserId();
    const isInit = await getStorageItem(getInitializedKey());
    if (!isInit) {
      // Primera vez: marcamos todos los reportes existentes como vistos
      const combined = new Set([...get().openedReportIds, ...existingReportIds]);
      set({ openedReportIds: combined, isInitialized: true, loadedUserId: uid });
      await setStorageItem(getStorageKey(), JSON.stringify(Array.from(combined)));
      await setStorageItem(getInitializedKey(), 'true');
    } else {
      set({ isInitialized: true, loadedUserId: uid });
    }
  },

  markReportAsOpened: async (id: string) => {
    const next = new Set(get().openedReportIds);
    next.add(id);
    set({ openedReportIds: next });
    await setStorageItem(getStorageKey(), JSON.stringify(Array.from(next)));
  },

  setOpenedReportIds: (ids: Set<string>) =>
    set((state) => {
      const next = new Set([...state.openedReportIds, ...ids]);
      return { openedReportIds: next };
    }),

  isReportOpened: (id: string) => get().openedReportIds.has(id),
}));
