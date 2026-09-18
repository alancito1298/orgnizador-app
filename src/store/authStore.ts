import { create } from 'zustand';
import { apiFetch, saveToken, removeToken, getToken } from '../api/client';

interface Docente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  provincia?: string | null;
  localidad?: string | null;
}

interface AuthState {
  token: string | null;
  docente: Docente | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export interface RegisterData {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  telefono: string;
  provincia: string;
  localidad: string;
  fechaNacimiento: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  docente: null,
  isLoading: true,

  loadToken: async () => {
    const token = await getToken();

    if (token) {
      try {
        const docente = await apiFetch<Docente>('/auth/me', { auth: true });
        console.log('[authStore] loadToken /auth/me success:', docente?.email);
        set({ token, docente, isLoading: false });
      } catch (err: any) {
        console.error('[authStore] loadToken /auth/me error:', err?.message || err);
        if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
          console.warn('[authStore] Token expired or invalid (401), removing token...');
          await removeToken();
          set({ token: null, docente: null, isLoading: false });
        } else {
          console.warn('[authStore] Network error on /auth/me, retaining token...');
          set({ token, isLoading: false });
        }
      }
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const data = await apiFetch<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    await saveToken(data.access_token);
    const docente = await apiFetch<Docente>('/auth/me', { auth: true });
    set({ token: data.access_token, docente });
  },

  register: async (registerData) => {
    const { repetirPassword, ...body } = registerData as RegisterData & { repetirPassword?: string };
    const data = await apiFetch<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        email: body.email.trim(),
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
      }),
    });
    await saveToken(data.access_token);
    const docente = await apiFetch<Docente>('/auth/me', { auth: true });
    set({ token: data.access_token, docente });
  },

  logout: async () => {
    await removeToken();
    set({ token: null, docente: null });
  },

  deleteAccount: async () => {
    await apiFetch('/auth/me', { method: 'DELETE', auth: true });
    await removeToken();
    set({ token: null, docente: null });
  },
}));
