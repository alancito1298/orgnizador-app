import { create } from 'zustand';
import { apiFetch, saveToken, removeToken, getToken } from '../api/client';

interface Docente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
}

interface AuthState {
  token: string | null;
  docente: Docente | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
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
        set({ token, docente, isLoading: false });
      } catch {
        await removeToken();
        set({ token: null, docente: null, isLoading: false });
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
}));
