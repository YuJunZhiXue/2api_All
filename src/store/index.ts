import { create } from 'zustand';

interface StoreState {
  status: any;
  sites: any[];
  sessions: any[];
  keys: any[];
  fetchStatus: () => Promise<void>;
  fetchSites: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchKeys: () => Promise<void>;
}

const API_BASE = '/api/admin';

export const useStore = create<StoreState>((set) => ({
  status: null,
  sites: [],
  sessions: [],
  keys: [],
  fetchStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const { data } = await res.json();
      set({ status: data });
    } catch (e) {
      console.error(e);
    }
  },
  fetchSites: async () => {
    try {
      const res = await fetch(`${API_BASE}/sites`);
      const { data } = await res.json();
      set({ sites: data });
    } catch (e) {
      console.error(e);
    }
  },
  fetchSessions: async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const { data } = await res.json();
      set({ sessions: data });
    } catch (e) {
      console.error(e);
    }
  },
  fetchKeys: async () => {
    try {
      const res = await fetch(`${API_BASE}/keys`);
      const { data } = await res.json();
      set({ keys: data });
    } catch (e) {
      console.error(e);
    }
  }
}));
