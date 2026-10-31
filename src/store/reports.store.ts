import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'centinel_seen_reports_v2';
const INITIALIZED_KEY = 'centinel_seen_reports_initialized_v2';

interface ReportsState {
  openedReportIds: Set<string>;
  isInitialized: boolean;
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

  loadPersistedSeenReports: async () => {
    const raw = await getStorageItem(STORAGE_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          set((state) => ({
            openedReportIds: new Set([...state.openedReportIds, ...arr]),
          }));
        }
      } catch {}
    }
  },

  initializeSeenReports: async (existingReportIds: string[]) => {
    const isInit = await getStorageItem(INITIALIZED_KEY);
    if (!isInit) {
      // Primera vez: marcamos todos los reportes existentes como vistos
      const combined = new Set([...get().openedReportIds, ...existingReportIds]);
      set({ openedReportIds: combined, isInitialized: true });
      await setStorageItem(STORAGE_KEY, JSON.stringify(Array.from(combined)));
      await setStorageItem(INITIALIZED_KEY, 'true');
    } else {
      set({ isInitialized: true });
    }
  },

  markReportAsOpened: async (id: string) => {
    const next = new Set(get().openedReportIds);
    next.add(id);
    set({ openedReportIds: next });
    await setStorageItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
  },

  setOpenedReportIds: (ids: Set<string>) =>
    set((state) => {
      const next = new Set([...state.openedReportIds, ...ids]);
      return { openedReportIds: next };
    }),

  isReportOpened: (id: string) => get().openedReportIds.has(id),
}));
