import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AlertMessage from '../../components/ui/AlertMessage';
import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING } from '../../theme';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Ingresá tu correo electrónico.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEnviado(true);
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="lock-open-outline" size={32} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
          <Text style={styles.subtitle}>
            Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {!enviado ? (
            <>
              {error && <AlertMessage type="error" message={error} />}

              <AppInput
                label="Correo Electrónico"
                iconName="mail-outline"
                placeholder="tu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
              />

              <AppButton
                label="Enviar link de recuperación"
                loading={loading}
                onPress={handleSubmit}
              />
            </>
          ) : (
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>📧</Text>
              <Text style={styles.successTitle}>Revisá tu email</Text>
              <Text style={styles.successText}>
                Si el email está registrado, recibirás un link para restablecer tu contraseña en los próximos minutos.
              </Text>
            </View>
          )}

          <AppButton
            label="Volver al inicio de sesión"
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, padding: SPACING.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  logoContainer: {
    width: 64, height: 64, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.accentLight, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.onSurface, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.secondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl, gap: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20,
    elevation: 6, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  successContainer: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg },
  successEmoji: { fontSize: 48 },
  successTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  successText: { fontSize: 13, color: COLORS.secondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, fontWeight: '500' },
});
