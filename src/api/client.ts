import * as SecureStore from 'expo-secure-store';
import {
  saveOfflineCache,
  getOfflineCache,
  enqueueSyncAction,
  useOfflineStore,
} from '../utils/offlineSync';

export const API_URL = 'https://backend-organizador.vercel.app';

export const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type FetchOptions = RequestInit & { auth?: boolean; skipOffline?: boolean };

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('connection refused')
  );
}

function deducirTipoAccion(path: string): 'asistencia' | 'calificacion' | 'alumno' | 'agenda' | 'general' {
  if (path.includes('/asistencias')) return 'asistencia';
  if (path.includes('/calificaciones')) return 'calificacion';
  if (path.includes('/alumnos') || path.includes('/inscripciones')) return 'alumno';
  if (path.includes('/agenda') || path.includes('/horarios')) return 'agenda';
  return 'general';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = false, headers = {}, skipOffline = false, ...rest } = options;
  const method = (options.method || 'GET').toUpperCase();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn(`[apiFetch] ${path} - auth=true pero NO hay token en SecureStore`);
    }
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: defaultHeaders,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const message =
        errData?.message ??
        (Array.isArray(errData?.message) ? errData.message[0] : null) ??
        `Error ${res.status}`;
      console.error(`[apiFetch] ${path} ERROR:`, res.status, message);
      throw new Error(Array.isArray(message) ? message[0] : message);
    }

    const data = (await res.json()) as T;

    // Si fue GET exitoso, guardamos una copia en caché offline
    if (method === 'GET' && !skipOffline) {
      saveOfflineCache(path, data);
      useOfflineStore.getState().setOffline(false);
    }

    return data;
  } catch (err: any) {
    const networkFailed = isNetworkError(err);

    // ── GESTIÓN DE ERROR OFFLINE ──
    if (networkFailed && !skipOffline) {
      useOfflineStore.getState().setOffline(true);

      // CASO 1: Consulta GET offline -> Servir desde caché local
      if (method === 'GET') {
        const cached = await getOfflineCache<T>(path);
        if (cached !== null) {
          console.log(`[apiFetch] 📴 Recuperado de caché offline: GET ${path}`);
          return cached;
        }
      }

      // CASO 2: Mutación offline (POST / PUT / DELETE) -> Encolar en cola de sincronización
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        let parsedBody: any = undefined;
        try {
          if (options.body && typeof options.body === 'string') {
            parsedBody = JSON.parse(options.body);
          }
        } catch {}

        await enqueueSyncAction({
          path,
          method: method as 'POST' | 'PUT' | 'DELETE',
          body: parsedBody,
          tipo: deducirTipoAccion(path),
          descripcion: `${method} ${path}`,
        });

        // Retornar respuesta optimista para que la UI no quede congelada
        return {
          id: Date.now(),
          ...parsedBody,
          _offline: true,
        } as T;
      }
    }

    throw err;
  }
}
