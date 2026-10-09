import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAuthStore } from '../../store/authStore';

/**
 * Client ID de tipo "Aplicación web" de Google Cloud (el mismo que usa la web y el backend).
 * El idToken que devuelve Google tendrá este client como audience, así que el backend
 * lo valida sin cambios en /auth/google.
 */
const GOOGLE_WEB_CLIENT_ID =
  '463323400546-ue44lhsd55au3r2ocmrdcnttlv8e2ej1.apps.googleusercontent.com';

// Carga diferida: el módulo nativo no existe en Expo Go, así que evitamos que la app crashee.
let GoogleSigninModule: typeof import('@react-native-google-signin/google-signin') | null = null;
let configured = false;

function getGoogleSignin() {
  if (!GoogleSigninModule) {
    try {
      GoogleSigninModule = require('@react-native-google-signin/google-signin');
    } catch {
      GoogleSigninModule = null;
    }
  }
  if (GoogleSigninModule && !configured) {
    GoogleSigninModule.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  return GoogleSigninModule;
}

/** Logo "G" oficial multicolor de Google */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

type Props = {
  label?: string;
  onError?: (message: string) => void;
  onSuccess?: (info: { isNewUser: boolean }) => void;
  disabled?: boolean;
};

export default function GoogleButton({
  label = 'Continuar con Google',
  onError,
  onSuccess,
  disabled,
}: Props) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    const mod = getGoogleSignin();
    if (!mod) {
      onError?.('El inicio con Google requiere la app instalada (no funciona en Expo Go).');
      return;
    }
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Forzamos el selector de cuenta cada vez
      await GoogleSignin.signOut().catch(() => {});
      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) return; // usuario canceló

      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google no devolvió un token válido.');

      const result = await loginWithGoogle(idToken);
      onSuccess?.(result);
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.IN_PROGRESS) return;
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError?.('Google Play Services no está disponible en este dispositivo.');
          return;
        }
      }
      console.error('[GoogleButton] error:', err);
      onError?.('Error al iniciar sesión con Google. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: 'rgba(31,31,31,0.12)' }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color="#1F1F1F" style={styles.icon} />
        ) : (
          <View style={styles.icon}>
            <GoogleLogo size={20} />
          </View>
        )}
        <Text style={[styles.label, isDisabled && styles.labelDisabled]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// Especificación del botón estándar de Google (tema claro / "outline")
const styles = StyleSheet.create({
  button: {
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { backgroundColor: '#EAEAEA' },
  disabled: {
    backgroundColor: 'rgba(255,255,255,0.61)',
    borderColor: 'rgba(31,31,31,0.12)',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: 0.25,
    fontFamily: Platform.select({ android: 'Roboto', default: undefined }), // fuente oficial de Google
  },
  labelDisabled: { opacity: 0.38 },
});
