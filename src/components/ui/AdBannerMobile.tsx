import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

import { apiFetch } from '../../api/client';
import { useKeyboard } from '../../hooks/useKeyboard';

const DISMISS_KEY = 'organizador_ad_dismissed_session';

/**
 * ID oficial de la unidad Banner en Google AdMob (Organizador Docente).
 * App ID (configurado en app.json): ca-app-pub-3715321688716274~1485732126
 */
const ADMOB_BANNER_UNIT_ID = 'ca-app-pub-3715321688716274/2980657523';

// Carga diferida y segura del módulo nativo de Google Mobile Ads
// Evita crasheos en Expo Go o compilaciones previas que aún no incluyan el binario nativo
let GoogleMobileAdsModule: typeof import('react-native-google-mobile-ads') | null = null;
let sdkInitialized = false;

function isNativeAdMobAvailable(): boolean {
  try {
    if (NativeModules && NativeModules.RNGoogleMobileAdsModule) {
      return true;
    }
    if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
      const mod = TurboModuleRegistry.get('RNGoogleMobileAdsModule');
      if (mod) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function getAdMobModule() {
  if (GoogleMobileAdsModule) {
    return GoogleMobileAdsModule;
  }

  if (!isNativeAdMobAvailable()) {
    return null;
  }

  try {
    const mod = require('react-native-google-mobile-ads');
    if (mod) {
      if (!sdkInitialized && typeof mod.default === 'function') {
        mod
          .default()
          .initialize()
          .catch(() => {});
        sdkInitialized = true;
      }
      GoogleMobileAdsModule = mod;
      return GoogleMobileAdsModule;
    }
  } catch (e: any) {
    console.warn('[AdMob] Módulo nativo no disponible en este entorno:', e?.message || e);
    GoogleMobileAdsModule = null;
    return null;
  }

  return null;
}

// Promociones educativas de respaldo (se muestran mientras carga AdMob o si aún está en revisión)
const PROMO_ADS = [
  {
    id: 1,
    badge: 'DOCENTE',
    titulo: '🎓 Capacitación Pedagógica 2026',
    subtitulo: 'Secuencias didácticas y rúbricas listas',
    url: 'https://www.organizadordocente.com',
  },
  {
    id: 2,
    badge: 'RECURSO',
    titulo: '📚 +100 Planificaciones y Materiales',
    subtitulo: 'Descargá recursos listos para el aula',
    url: 'https://www.organizadordocente.com',
  },
  {
    id: 3,
    badge: 'PROMO',
    titulo: '🤖 Asistente de IA para Docentes',
    subtitulo: 'Creá exámenes y actividades en 1 clic',
    url: 'https://www.organizadordocente.com',
  },
];

export default function AdBannerMobile() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();

  const [visible, setVisible] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [admobLoaded, setAdmobLoaded] = useState(false);
  const [admobFailed, setAdmobFailed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const admobMod = getAdMobModule();

  useEffect(() => {
    let isMounted = true;

    async function checkAdsEligibility() {
      try {
        // 1. Si el usuario ya lo cerró en esta sesión, no molestarlo
        const dismissed = await SecureStore.getItemAsync(DISMISS_KEY);
        if (dismissed === '1') {
          return;
        }

        // 2. Verificar si el usuario es Premium
        const suscripcion = await apiFetch<any>('/suscripciones/estado', { auth: true });
        if (
          suscripcion &&
          suscripcion.estado === 'activa' &&
          suscripcion.periodo !== 'gratis'
        ) {
          // Usuario Premium: CERO anuncios
          return;
        }

        if (isMounted) {
          setVisible(true);
        }
      } catch {
        // Si hay error de red o no está logueado, mantener visible discretamente
        if (isMounted) setVisible(true);
      }
    }

    checkAdsEligibility();

    // Rotación suave del banner de respaldo cada 10 segundos
    const timer = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % PROMO_ADS.length);
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(async () => {
      setVisible(false);
      try {
        await SecureStore.setItemAsync(DISMISS_KEY, '1');
      } catch {}
    });
  };

  const handleOpenPromo = (url: string) => {
    try {
      Linking.openURL(url);
    } catch {}
  };

  const handleGoToPremium = () => {
    try {
      navigation.navigate('Planes');
    } catch {}
  };

  if (!visible || isKeyboardVisible) return null;

  const current = PROMO_ADS[adIndex];
  const BannerAdComponent = admobMod?.BannerAd;
  const BannerAdSizeEnum = admobMod?.BannerAdSize;
  const TestIdsEnum = admobMod?.TestIds;

  const unitId =
    __DEV__ && TestIdsEnum?.BANNER ? TestIdsEnum.BANNER : ADMOB_BANNER_UNIT_ID;

  const canRenderAdMob = Boolean(BannerAdComponent && BannerAdSizeEnum && !admobFailed);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + 76, // Se posiciona discretamente justo sobre la barra inferior
          opacity: fadeAnim,
          transform: [
            {
              scale: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.bannerContainer, admobLoaded && styles.bannerContainerAdMob]}>
        {/* Anuncio nativo de Google AdMob (cuando el binario nativo está compilado) */}
        {canRenderAdMob && BannerAdComponent && BannerAdSizeEnum && (
          <View style={[styles.admobSlot, !admobLoaded && styles.hiddenAdSlot]}>
            <BannerAdComponent
              unitId={unitId}
              size={BannerAdSizeEnum.BANNER}
              onAdLoaded={() => {
                setAdmobLoaded(true);
                setAdmobFailed(false);
              }}
              onAdFailedToLoad={() => {
                setAdmobLoaded(false);
                setAdmobFailed(true);
              }}
            />
          </View>
        )}

        {/* Respaldo educativo mientras carga AdMob o si la cuenta aún está en revisión */}
        {!admobLoaded && (
          <TouchableOpacity
            style={styles.contentTouch}
            activeOpacity={0.85}
            onPress={() => handleOpenPromo(current.url)}
          >
            <View style={styles.badgeWrapper}>
              <Text style={styles.badgeText}>{current.badge}</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {current.titulo}
              </Text>
              <Text style={styles.subtitulo} numberOfLines={1}>
                {current.subtitulo}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Acciones: Quitar Ads (Premium) y Cerrar (X) */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.removeAdsBtn}
            activeOpacity={0.8}
            onPress={handleGoToPremium}
          >
            <MaterialCommunityIcons name="crown" size={13} color="#fbbf24" />
            <Text style={styles.removeAdsText}>PRO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={15} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
    alignItems: 'center',
  },
  bannerContainer: {
    width: '100%',
    maxWidth: 520,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(23, 21, 47, 0.96)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerContainerAdMob: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  admobSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hiddenAdSlot: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
  },
  contentTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  badgeWrapper: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  subtitulo: {
    color: '#a78bfa',
    fontSize: 9.5,
    marginTop: 0.5,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  removeAdsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  removeAdsText: {
    color: '#fbbf24',
    fontSize: 9.5,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
