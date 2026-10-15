import * as Sentry from '@sentry/react-native';

/**
 * Reemplazá este DSN con el que te da Sentry al crear tu proyecto (Platform: React Native).
 * Ejemplo: 'https://xxxxxx@o123456.ingest.us.sentry.io/7891011'
 */
export const SENTRY_DSN = 'https://5aa4f251945f31e2b66673085cb37dec@o4512260297129984.ingest.us.sentry.io/4512260514185216';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN no configurado aún. Sentry permanecerá inactivo.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // 1.0 para capturar el 100% de transacciones durante la fase beta/pruebas
    tracesSampleRate: 1.0,
    // Desactiva logs ruidosos en consola
    debug: false,
    // Identificador de entorno
    environment: __DEV__ ? 'development' : 'production',
    // Si estás en desarrollo local, no enviar errores para no consumir cuota
    enabled: !__DEV__ || Boolean(SENTRY_DSN),
  });
}

/**
 * Vincula los datos del docente autenticado al reporte de errores en Sentry.
 */
export function setSentryUser(docente: { id: number; email: string; nombre?: string; apellido?: string } | null) {
  if (!SENTRY_DSN) return;

  if (docente) {
    Sentry.setUser({
      id: String(docente.id),
      email: docente.email,
      username: `${docente.nombre || ''} ${docente.apellido || ''}`.trim(),
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Captura un error manualmente con contexto opcional.
 */
export function logError(error: any, context?: Record<string, any>) {
  console.error('[Error Tracker]:', error, context);
  if (!SENTRY_DSN) return;

  if (context) {
    Sentry.setContext('extra_context', context);
  }
  Sentry.captureException(error);
}

export { Sentry };
