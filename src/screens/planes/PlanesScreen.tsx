import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

interface PlanItem {
  id: string;
  nombre: string;
  periodo: string;
  precio: string;
  frecuencia: string;
  planMpId: string;
  gratis: boolean;
  badgeTop: string;
  badgeSub: string;
  popular?: boolean;
  features: string[];
}

const PLANES_DATA: PlanItem[] = [
  {
    id: 'gratis',
    nombre: 'Plan Básico',
    periodo: 'Gratuito',
    precio: '$0',
    frecuencia: 'para siempre',
    planMpId: 'gratis',
    gratis: true,
    badgeTop: '100% GRATIS',
    badgeSub: '🌱 Sin Tarjeta',
    features: [
      'Hasta 4 cursos activos',
      'Estudiantes ilimitados',
      'Asistencias y Calificaciones',
      'Agenda de clases y Horarios',
      'Anuncios discretos',
    ],
  },
  {
    id: 'plus_mensual',
    nombre: 'Plan Plus',
    periodo: 'Mensual',
    precio: '$4.999',
    frecuencia: 'por mes',
    planMpId: '00418792d857442da35980be23928b2a',
    gratis: false,
    popular: true,
    badgeTop: '⭐ MÁS POPULAR · ¡30 DÍAS GRATIS!',
    badgeSub: 'Acceso total sin límites',
    features: [
      '🤖 Asistente Pedagógico IA ilimitado',
      'Cursos y divisiones ilimitadas',
      'Exportación a PDF Oficial y Excel (.xlsx)',
      'Cero publicidad / Sin anuncios',
      'Planificaciones y secuencias didácticas',
      'Soporte prioritario para docentes',
    ],
  },
  {
    id: 'plus_anual',
    nombre: 'Plan Plus',
    periodo: 'Anual',
    precio: '$39.999',
    frecuencia: 'por año ($3.333/mes)',
    planMpId: '055a8d3ffb0f403eb1376ed38adde4ba',
    gratis: false,
    badgeTop: '🔥 MÁXIMO AHORRO · ¡30 DÍAS GRATIS!',
    badgeSub: 'Ahorrás $20.000 al año',
    features: [
      'Todo lo incluido en el Plan Plus Mensual',
      'Acceso continuo durante todo el ciclo lectivo',
      '🤖 Asistente Pedagógico IA ilimitado',
      'Exportaciones ilimitadas a PDF y Excel',
      'Cero publicidad / Sin anuncios',
      'Precio congelado por 12 meses',
    ],
  },
];

export default function PlanesScreen() {
  const navigation = useNavigation<Nav>();

  const [suscripcionActual, setSuscripcionActual] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cargarEstadoSuscripcion = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/suscripciones/estado', { auth: true });
      setSuscripcionActual(data);
    } catch (e) {
      console.warn('Error al consultar estado de suscripción:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarEstadoSuscripcion();
    }, [cargarEstadoSuscripcion])
  );

  const onRefresh = () => {
    setRefreshing(true);
    cargarEstadoSuscripcion();
  };

  const handleSeleccionarPlan = (plan: PlanItem) => {
    if (plan.gratis) {
      if (suscripcionActual?.periodo === 'gratis' || !suscripcionActual?.estado || suscripcionActual?.estado === 'sin_suscripcion') {
        Alert.alert('Plan Actual', 'Ya tenés activo el Plan Gratuito.');
        return;
      }

      Alert.alert(
        'Activar Plan Gratuito',
        '¿Deseás volver al plan gratuito con funciones básicas y anuncios?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Activar Gratis',
            onPress: async () => {
              setProcesandoId(plan.id);
              try {
                await apiFetch('/suscripciones/activar-gratis', { method: 'POST', auth: true });
                Alert.alert('¡Listo!', 'El plan gratuito se activó correctamente.');
                cargarEstadoSuscripcion();
              } catch {
                Alert.alert('Error', 'No se pudo activar el plan gratuito.');
              } finally {
                setProcesandoId(null);
              }
            },
          },
        ]
      );
      return;
    }

    // Flujo de pago para Plan de Pago (Mercado Pago)
    Alert.alert(
      `Suscribirse a ${plan.nombre} ${plan.periodo}`,
      `Te redirigiremos a Mercado Pago para confirmar tu suscripción (${plan.precio} ${plan.frecuencia}). Incluye 30 días de prueba sin cargo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar a Mercado Pago',
          onPress: async () => {
            setProcesandoId(plan.id);
            try {
              const res = await apiFetch<{ checkoutUrl: string }>('/suscripciones/checkout', {
                method: 'POST',
                auth: true,
                body: JSON.stringify({ planMpId: plan.planMpId }),
              });

              if (res?.checkoutUrl) {
                await Linking.openURL(res.checkoutUrl);
              } else {
                throw new Error('No se recibió la URL de pago');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'No se pudo iniciar el proceso de pago.');
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  };

  const esPlanActual = (plan: PlanItem) => {
    if (!suscripcionActual) return false;
    if (plan.gratis && (suscripcionActual.periodo === 'gratis' || suscripcionActual.estado === 'sin_suscripcion')) {
      return true;
    }
    if (!plan.gratis && suscripcionActual.estado === 'activa') {
      const periodoSub = (suscripcionActual.periodo || '').toLowerCase();
      return periodoSub === plan.periodo.toLowerCase();
    }
    return false;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── CABECERA ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Planes y Suscripción</Text>
          <Text style={styles.headerSub}>Elegí la mejor opción para tu labor docente</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Cargando información de planes...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        >
          {/* Banner informativo de prueba gratuita */}
          <View style={styles.promoBanner}>
            <MaterialCommunityIcons name="star-shooting" size={26} color="#fbbf24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.promoBannerTitle}>¡30 Días de Prueba Gratis!</Text>
              <Text style={styles.promoBannerSub}>
                Probá todas las funciones del Plan Plus sin cargo. Podés cancelar en cualquier momento desde Mercado Pago.
              </Text>
            </View>
          </View>

          {/* Lista de Planes */}
          {PLANES_DATA.map((plan) => {
            const actual = esPlanActual(plan);
            const procesando = procesandoId === plan.id;

            return (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  plan.popular && styles.cardPopular,
                  actual && styles.cardActual,
                ]}
              >
                {/* Badge Superior */}
                <View
                  style={[
                    styles.badgeTopBox,
                    plan.popular
                      ? styles.badgeTopPopular
                      : plan.gratis
                      ? styles.badgeTopGratis
                      : styles.badgeTopAnual,
                  ]}
                >
                  <Text style={styles.badgeTopText}>{plan.badgeTop}</Text>
                </View>

                {/* Encabezado del Plan */}
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <Text style={styles.planNombre}>{plan.nombre}</Text>
                    {plan.periodo ? (
                      <View style={styles.periodoBadge}>
                        <Text style={styles.periodoText}>{plan.periodo}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.badgeSubText}>{plan.badgeSub}</Text>
                </View>

                {/* Precio */}
                <View style={styles.precioBox}>
                  <Text style={styles.precioMonto}>{plan.precio}</Text>
                  <Text style={styles.precioFrecuencia}> / {plan.frecuencia}</Text>
                </View>

                {/* Divisor */}
                <View style={styles.divider} />

                {/* Lista de Características */}
                <View style={styles.featuresList}>
                  {plan.features.map((feat, fIdx) => (
                    <View key={fIdx} style={styles.featureItem}>
                      <Ionicons
                        name={feat.startsWith('Anuncios') ? 'alert-circle-outline' : 'checkmark-circle'}
                        size={17}
                        color={feat.startsWith('Anuncios') ? '#f59e0b' : '#10b981'}
                      />
                      <Text style={[styles.featureText, feat.includes('IA') && styles.featureTextHighlight]}>
                        {feat}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Botón de Acción */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    plan.popular ? styles.actionBtnPopular : styles.actionBtnNormal,
                    actual && styles.actionBtnActual,
                  ]}
                  onPress={() => handleSeleccionarPlan(plan)}
                  disabled={procesando || actual}
                  activeOpacity={0.85}
                >
                  {procesando ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : actual ? (
                    <View style={styles.btnRow}>
                      <Ionicons name="checkmark-done" size={17} color="#059669" />
                      <Text style={styles.actionBtnTextActual}>Plan Activo</Text>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      {!plan.gratis && <MaterialCommunityIcons name="lightning-bolt" size={17} color="#ffffff" />}
                      <Text style={styles.actionBtnText}>
                        {plan.gratis ? 'Elegir Plan Gratuito' : `Comenzar con ${plan.nombre}`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Seguridad y Medios de Pago */}
          <View style={styles.securityBox}>
            <Ionicons name="lock-closed" size={16} color={COLORS.secondary} />
            <Text style={styles.securityText}>
              Pagos seguros y encriptados procesados por Mercado Pago. Cancelación fácil con un click en cualquier momento.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.surface,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.secondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 120,
    gap: 16,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1b4b',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#7c3aed40',
  },
  promoBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fbbf24',
  },
  promoBannerSub: {
    fontSize: 11,
    color: '#e2e8f0',
    marginTop: 2,
    lineHeight: 15,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardPopular: {
    borderColor: '#7c3aed',
    borderWidth: 2,
    backgroundColor: '#faf5ff',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardActual: {
    borderColor: '#10b981',
  },
  badgeTopBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeTopPopular: {
    backgroundColor: '#7c3aed',
  },
  badgeTopGratis: {
    backgroundColor: '#059669',
  },
  badgeTopAnual: {
    backgroundColor: '#b45309',
  },
  badgeTopText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardHeader: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planNombre: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  periodoBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  periodoText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  badgeSubText: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
  },
  precioBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  precioMonto: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e1b4b',
  },
  precioFrecuencia: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 12,
  },
  featuresList: {
    gap: 9,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: COLORS.onSurface,
    flex: 1,
  },
  featureTextHighlight: {
    fontWeight: '700',
    color: '#6d28d9',
  },
  actionBtn: {
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPopular: {
    backgroundColor: '#7c3aed',
  },
  actionBtnNormal: {
    backgroundColor: '#1e1b4b',
  },
  actionBtnActual: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionBtnTextActual: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  securityText: {
    fontSize: 10.5,
    color: COLORS.secondary,
    flex: 1,
    textAlign: 'center',
    lineHeight: 14,
  },
});
