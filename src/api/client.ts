import * as SecureStore from 'expo-secure-store';

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

type FetchOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = false, headers = {}, ...rest } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

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
    throw new Error(Array.isArray(message) ? message[0] : message);
  }

  return res.json() as Promise<T>;
}
