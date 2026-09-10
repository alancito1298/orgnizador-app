import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SEEN_NOTIF_KEY = 'organizador_seen_notif_ids';

interface NotifState {
  seenIds: number[];
  ingresoVisto: boolean;
  isLoaded: boolean;
  loadSeen: () => Promise<void>;
  markAsSeen: (ids: number[]) => Promise<void>;
  setIngresoVisto: (visto: boolean) => void;
}

export const useNotifStore = create<NotifState>((set, get) => ({
  seenIds: [],
  ingresoVisto: false,
  isLoaded: false,

  loadSeen: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SEEN_NOTIF_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ seenIds: parsed, isLoaded: true });
          return;
        }
      }
    } catch (e) {
      console.warn('[notifStore] Error loading seen notif ids:', e);
    }
    set({ isLoaded: true });
  },

  markAsSeen: async (ids: number[]) => {
    if (!ids || ids.length === 0) return;
    const current = get().seenIds;
    const combined = Array.from(new Set([...current, ...ids]));
    set({ seenIds: combined });

    try {
      await SecureStore.setItemAsync(SEEN_NOTIF_KEY, JSON.stringify(combined));
    } catch (e) {
      console.warn('[notifStore] Error saving seen notif ids:', e);
    }
  },

  setIngresoVisto: (visto: boolean) => {
    set({ ingresoVisto: visto });
  },
}));
