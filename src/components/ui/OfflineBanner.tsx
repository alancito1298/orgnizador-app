import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../../utils/offlineSync';
import { COLORS, RADIUS, SPACING } from '../../theme';

export default function OfflineBanner() {
  const { isOffline, isSyncing, pendingCount, triggerSync } = useOfflineStore();

  // Solo se muestra si está offline o hay acciones pendientes de sincronizar
  if (!isOffline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.pill,
          isSyncing
            ? styles.pillSyncing
            : pendingCount > 0
            ? styles.pillPending
            : styles.pillOffline,
        ]}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color="#ffffff" style={styles.icon} />
        ) : (
          <Ionicons
            name={pendingCount > 0 ? 'cloud-upload-outline' : 'cloud-offline-outline'}
            size={16}
            color="#ffffff"
            style={styles.icon}
          />
        )}

        <View style={styles.textContainer}>
          <Text style={styles.titleText}>
            {isSyncing
              ? 'Sincronizando cambios con la nube...'
              : pendingCount > 0
              ? `${pendingCount} cambio${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}`
              : 'Modo Sin Conexión (Offline)'}
          </Text>
          <Text style={styles.subText}>
            {isSyncing
              ? 'Guardando datos en el servidor'
              : pendingCount > 0
              ? 'Se sincronizarán al recuperar señal'
              : 'Tus datos cargados están protegidos'}
          </Text>
        </View>

        {!isSyncing && (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => triggerSync()}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={13} color="#ffffff" />
            <Text style={styles.syncBtnText}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: 'center',
    zIndex: 99,
  },
  pill: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  pillOffline: {
    backgroundColor: '#b45309', // Ámbar oscuro
  },
  pillPending: {
    backgroundColor: '#0284c7', // Azul informativo
  },
  pillSyncing: {
    backgroundColor: '#7c3aed', // Violeta acento
  },
  icon: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  subText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 0.5,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  syncBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffffff',
  },
});
