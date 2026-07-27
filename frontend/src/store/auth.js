import { create } from 'zustand';
import { authApi } from '../api';

export const useAuth = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  role: localStorage.getItem('role') || null,
  loading: false,
  initialized: false,

  async login(username, password) {
    const data = await authApi.login({ username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    set({ token: data.token, role: data.role });
    const me = await authApi.me();
    set({ user: me });
    return data;
  },

  async loadUser() {
    if (!get().token) {
      set({ initialized: true });
      return;
    }
    set({ loading: true });
    try {
      const me = await authApi.me();
      set({ user: me, role: me.role });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      set({ user: null, token: null, role: null });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  async logout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    set({ user: null, token: null, role: null });
  },
}));
