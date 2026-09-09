import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

interface PerfilData {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  provincia?: string | null;
  localidad?: string | null;
}

interface SuscripcionData {
  estado: string;
  fechaFin?: string;
  enTrial?: boolean;
  diasRestantesTrial?: number;
  plan?: {
    id: number;
    nombre: string;
    precio?: number;
  };
}

interface ResumenData {
  diasUsandoSistema: number;
  totalCursos: number;
  totalAlumnos: number;
  totalAsistencias: number;
  totalCalificaciones: number;
  totalHorarios: number;
  totalPlanificaciones: number;
}

export default function PerfilScreen() {
  const navigation = useNavigation<Nav>();
  const { logout, docente: docenteAuth } = useAuthStore();

  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [suscripcion, setSuscripcion] = useState<SuscripcionData | null>(null);
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [totalCursosCount, setTotalCursosCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [perfilRes, suscripcionRes, resumenRes, cursosRes] = await Promise.allSettled([
        apiFetch<PerfilData>('/auth/me', { auth: true }),
        apiFetch<SuscripcionData>('/suscripciones/estado', { auth: true }),
        apiFetch<ResumenData>('/dashboard/resumen', { auth: true }),
        apiFetch<any[]>('/cursos', { auth: true }),
      ]);

      if (perfilRes.status === 'fulfilled' && perfilRes.value) {
        setPerfil(perfilRes.value);
      }
      if (suscripcionRes.status === 'fulfilled' && suscripcionRes.value) {
        setSuscripcion(suscripcionRes.value);
      }
      if (resumenRes.status === 'fulfilled' && resumenRes.value) {
        setResumen(resumenRes.value);
      }
      if (cursosRes.status === 'fulfilled' && Array.isArray(cursosRes.value)) {
        setTotalCursosCount(cursosRes.value.length);
      }
    } catch (e) {
      console.error('Error cargando datos de perfil:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseás cerrar sesión en tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.error('Error al cerrar sesión:', err);
            }
          },
        },
      ]
    );
  };

  // Iniciales del docente
  const nombreMostrado = perfil?.nombre || docenteAuth?.nombre || 'Docente';
  const apellidoMostrado = perfil?.apellido || docenteAuth?.apellido || '';
  const iniciales = `${nombreMostrado.charAt(0)}${apellidoMostrado.charAt(0)}`.toUpperCase() || 'D';

  const esSuscripcionActiva =
    suscripcion?.estado === 'activa' || suscripcion?.estado === 'trial';
  const nombrePlan =
    suscripcion?.plan?.nombre?.toUpperCase() || (suscripcion?.enTrial ? 'PRUEBA GRATIS' : 'FREE');

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {/* ── CABECERA DARK VIOLET (Fiel al web PerfilDocente) ── */}
        <View style={styles.headerBox}>
          {/* Avatar circular con iniciales */}
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{iniciales}</Text>
          </View>

          {/* Nombre y Apellido */}
          <Text style={styles.nombreDocente}>
            {nombreMostrado} {apellidoMostrado}
          </Text>

          {/* Email */}
          <Text style={styles.emailDocente}>{perfil?.email || docenteAuth?.email}</Text>

          {/* ID Docente */}
          <View style={styles.idBadge}>
            <Text style={styles.idText}>
              ID: #{String(perfil?.id || docenteAuth?.id || 1).padStart(3, '0')}
            </Text>
          </View>

          {/* Badge Estado Suscripción */}
          <View
            style={[
              styles.estadoBadge,
              esSuscripcionActiva ? styles.estadoActivo : styles.estadoInactivo,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: esSuscripcionActiva ? '#10b981' : '#f59e0b' },
              ]}
            />
            <Text style={styles.estadoBadgeText}>
              {esSuscripcionActiva
                ? suscripcion?.enTrial
                  ? `Período de prueba (${suscripcion.diasRestantesTrial ?? 7} días)`
                  : 'Suscripción Activa'
                : 'Sin suscripción activa'}
            </Text>
          </View>
        </View>

        {/* ── TARJETA DE SUSCRIPCIÓN ── */}
        <View style={styles.cardContainer}>
          <View style={styles.subCardHeader}>
            <View style={styles.subTitleRow}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.accent} />
              <Text style={styles.subCardTitle}>Suscripción</Text>
            </View>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{nombrePlan}</Text>
            </View>
          </View>

          <View style={styles.subGrid}>
            <View style={styles.subGridCol}>
              <Text style={styles.subColLabel}>ESTADO</Text>
              <Text
                style={[
                  styles.subColVal,
                  { color: esSuscripcionActiva ? '#059669' : COLORS.onSurface },
                ]}
              >
                {esSuscripcionActiva ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
            <View style={styles.subGridCol}>
              <Text style={styles.subColLabel}>PLAN</Text>
              <Text style={styles.subColVal}>
                {suscripcion?.plan?.nombre || (suscripcion?.enTrial ? 'Trial Pro' : 'Gratuito')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── SECCIÓN MÉTRICAS GLOBALES (Grid 2x2 Fiel al web PerfilResumen) ── */}
        <Text style={styles.sectionHeaderTitle}>MÉTRICAS DEL SISTEMA</Text>
        <View style={styles.statsGrid}>
          {/* Cursos */}
          <View style={styles.statCard}>
            <Ionicons
              name="school-outline"
              size={22}
              color="rgba(255,255,255,0.7)"
              style={styles.statIcon}
            />
            <Text style={styles.statNumber}>
              {resumen?.totalCursos ?? totalCursosCount}
            </Text>
            <Text style={styles.statLabel}>CURSOS ACTIVOS</Text>
          </View>

          {/* Alumnos */}
          <View style={styles.statCard}>
            <Ionicons
              name="people-outline"
              size={22}
              color="rgba(255,255,255,0.7)"
              style={styles.statIcon}
            />
            <Text style={styles.statNumber}>{resumen?.totalAlumnos ?? 0}</Text>
            <Text style={styles.statLabel}>ESTUDIANTES</Text>
          </View>

          {/* Días en el sistema */}
          <View style={styles.statCard}>
            <Ionicons
              name="flame-outline"
              size={22}
              color="rgba(255,255,255,0.7)"
              style={styles.statIcon}
            />
            <Text style={styles.statNumber}>{resumen?.diasUsandoSistema ?? 1}</Text>
            <Text style={styles.statLabel}>DÍAS ONLINE</Text>
          </View>

          {/* Ciclo Lectivo */}
          <View style={styles.statCard}>
            <Ionicons
              name="calendar-outline"
              size={22}
              color="rgba(255,255,255,0.7)"
              style={styles.statIcon}
            />
            <Text style={styles.statNumber}>{new Date().getFullYear()}</Text>
            <Text style={styles.statLabel}>CICLO LECTIVO</Text>
          </View>
        </View>

        {/* ── DATOS DE CONTACTO / CUENTA (si existen) ── */}
        {(perfil?.telefono || perfil?.provincia || perfil?.localidad) && (
          <View style={styles.cardContainer}>
            <Text style={styles.cardSectionTitle}>Datos Personales</Text>
            {perfil?.telefono ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={COLORS.secondary} />
                <Text style={styles.infoText}>{perfil.telefono}</Text>
              </View>
            ) : null}
            {perfil?.localidad || perfil?.provincia ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.secondary} />
                <Text style={styles.infoText}>
                  {[perfil?.localidad, perfil?.provincia].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── BOTÓN CERRAR SESIÓN ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        {/* Versión de la app */}
        <Text style={styles.versionText}>Organizador Docente Mobile • v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1e1b4b', // Mantiene continuidad visual con el header oscuro
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 110, // Espacio para el BottomNav flotante
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.accent,
    fontWeight: '600',
  },

  // ── CABECERA DARK VIOLET ──
  headerBox: {
    backgroundColor: '#1e1b4b',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#c4b5fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e1b4b',
    letterSpacing: 1,
  },
  nombreDocente: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  emailDocente: {
    fontSize: FONT_SIZE.sm,
    color: '#c4b5fd',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  idBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  idText: {
    fontSize: FONT_SIZE.xs,
    color: '#ddd6fe',
    fontWeight: '600',
    letterSpacing: 1,
  },
  estadoBadge: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  estadoActivo: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  estadoInactivo: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── TARJETA SUSCRIPCIÓN ──
  cardContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  subTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subCardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  planBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  subGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  subGridCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  subColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subColVal: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: COLORS.onSurface,
  },

  // ── SECCIÓN MÉTRICAS GLOBALES ──
  sectionHeaderTitle: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 1,
  },
  statsGrid: {
    marginHorizontal: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: '#1e1b4b',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    minHeight: 140,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  statNumber: {
    fontSize: 38,
    fontWeight: '300',
    color: '#ede9fe',
    lineHeight: 44,
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c4b5fd',
    letterSpacing: 0.8,
  },

  // ── DATOS PERSONALES ──
  cardSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.secondary,
    fontWeight: '500',
  },

  // ── LOGOUT ──
  logoutBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    backgroundColor: '#fee2e2',
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#dc2626',
  },
  versionText: {
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '500',
  },
});
