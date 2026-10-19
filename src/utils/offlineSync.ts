import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { getToken, API_URL } from '../api/client';

export interface SyncAction {
  id: string;
  path: string; // Endpoint relativo (ej: '/asistencias') o URL completa
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  timestamp: number;
  tipo: 'asistencia' | 'calificacion' | 'alumno' | 'agenda' | 'general';
  descripcion: string;
}

interface OfflineState {
  isOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  setOffline: (offline: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingCount: (count: number) => void;
  triggerSync: () => Promise<{ synced: number; failed: number }>;
}

const QUEUE_FILE_NAME = 'od_offline_sync_queue.json';
const CACHE_DIR_NAME = 'od_cache/';

function getBaseDir(): string {
  return FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
}

function getQueueFilePath(): string {
  return `${getBaseDir()}${QUEUE_FILE_NAME}`;
}

function getCacheDirPath(): string {
  return `${getBaseDir()}${CACHE_DIR_NAME}`;
}

function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
}

/**
 * Zustand Store para el estado de conexión y sincronización
 */
export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOffline: false,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  setOffline: (offline: boolean) => set({ isOffline: offline }),
  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),
  setPendingCount: (count: number) => set({ pendingCount: count }),
  triggerSync: async () => {
    return processSyncQueue();
  },
}));

/**
 * Obtiene la lista de acciones pendientes guardadas en el almacenamiento persistente
 */
export async function getPendingSyncQueue(): Promise<SyncAction[]> {
  try {
    const filePath = getQueueFilePath();
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return [];

    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[OfflineSync] Error leyendo cola de sincronización:', err);
    return [];
  }
}

/**
 * Guarda la cola persistente en el dispositivo
 */
async function saveSyncQueue(queue: SyncAction[]): Promise<void> {
  try {
    const filePath = getQueueFilePath();
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(queue));
    useOfflineStore.getState().setPendingCount(queue.length);
  } catch (err) {
    console.error('[OfflineSync] Error guardando cola de sincronización:', err);
  }
}

/**
 * Encola una nueva acción para ser sincronizada cuando haya conexión
 */
export async function enqueueSyncAction(
  action: Omit<SyncAction, 'id' | 'timestamp'>
): Promise<SyncAction> {
  const newAction: SyncAction = {
    ...action,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
  };

  const queue = await getPendingSyncQueue();

  // Deduplicación inteligente: si ya hay una petición idéntica para el mismo endpoint y método, actualizarla
  const indexExistente = queue.findIndex(
    (item) => item.path === newAction.path && item.method === newAction.method
  );

  if (indexExistente >= 0 && (newAction.method === 'PUT' || newAction.method === 'POST')) {
    queue[indexExistente] = newAction;
  } else {
    queue.push(newAction);
  }

  await saveSyncQueue(queue);
  useOfflineStore.getState().setOffline(true);
  console.log(`[OfflineSync] 📥 Acción encolada (${newAction.tipo}): ${newAction.descripcion}. Total pendientes: ${queue.length}`);
  return newAction;
}

/**
 * Guarda una copia de datos en la caché local offline
 */
export async function saveOfflineCache(key: string, data: any): Promise<void> {
  try {
    const dir = getCacheDirPath();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const filePath = `${dir}${sanitizeCacheKey(key)}`;
    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (err) {
    console.warn('[OfflineSync] Error guardando caché local:', err);
  }
}

/**
 * Lee datos desde la caché local offline
 */
export async function getOfflineCache<T>(key: string): Promise<T | null> {
  try {
    const filePath = `${getCacheDirPath()}${sanitizeCacheKey(key)}`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;

    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    return parsed?.data as T;
  } catch (err) {
    console.warn('[OfflineSync] Error leyendo caché local:', err);
    return null;
  }
}

/**
 * Comprueba si hay conexión al backend realizando una petición liviana
 */
export async function checkOnlineStatus(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_URL}/cursos`, {
      method: 'HEAD',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);
    const online = res !== null;
    useOfflineStore.getState().setOffline(!online);
    return online;
  } catch {
    useOfflineStore.getState().setOffline(true);
    return false;
  }
}

/**
 * Procesa y envía todas las acciones pendientes en la cola
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const store = useOfflineStore.getState();
  if (store.isSyncing) return { synced: 0, failed: 0 };

  const queue = await getPendingSyncQueue();
  if (queue.length === 0) {
    store.setPendingCount(0);
    return { synced: 0, failed: 0 };
  }

  store.setSyncing(true);
  console.log(`[OfflineSync] 🔄 Iniciando sincronización de ${queue.length} acciones...`);

  const token = await getToken();
  const remainingQueue: SyncAction[] = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const fullUrl = item.path.startsWith('http') ? item.path : `${API_URL}${item.path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(fullUrl, {
        method: item.method,
        headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok || res.status === 404 || res.status === 409) {
        synced++;
        console.log(`[OfflineSync] ✅ Sincronizado: ${item.method} ${item.path}`);
      } else if (res.status >= 400 && res.status < 500) {
        // Error de cliente irrecuperable (ej: formato inválido): se descarta para no trabar la cola
        synced++;
        console.warn(`[OfflineSync] ⚠️ Descartado por error de cliente ${res.status}: ${item.path}`);
      } else {
        remainingQueue.push(item);
        failed++;
      }
    } catch (err) {
      remainingQueue.push(item);
      failed++;
    }
  }

  await saveSyncQueue(remainingQueue);
  store.setSyncing(false);
  store.setPendingCount(remainingQueue.length);
  useOfflineStore.setState({ lastSyncTime: Date.now(), isOffline: remainingQueue.length > 0 });

  console.log(`[OfflineSync] Fin sincronización: ${synced} exitosos, ${failed} pendientes.`);
  return { synced, failed };
}

/**
 * Inicializador del monitor offline (revisa cada 20 segundos si hay pendientes)
 */
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function initOfflineSyncMonitor() {
  // Cargar contador inicial
  getPendingSyncQueue().then((q) => {
    useOfflineStore.getState().setPendingCount(q.length);
  });

  if (!syncInterval) {
    syncInterval = setInterval(async () => {
      const queue = await getPendingSyncQueue();
      if (queue.length > 0) {
        const isOnline = await checkOnlineStatus();
        if (isOnline) {
          await processSyncQueue();
        }
      }
    }, 20000);
  }
}
