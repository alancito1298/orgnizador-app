import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AlertMessage from '../../components/ui/AlertMessage';
import GoogleButton from '../../components/ui/GoogleButton';
import { useAuthStore, type RegisterData } from '../../store/authStore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AuthStackParamList } from '../../../navigation/AuthNavigator';

const PROVINCIAS = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta',
  'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const register = useAuthStore((s) => s.register);

  const [form, setForm] = useState<RegisterData & { repetirPassword: string }>({
    nombre: '', apellido: '', email: '', password: '',
    repetirPassword: '', telefono: '', provincia: '',
    localidad: '', fechaNacimiento: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProvincias, setShowProvincias] = useState(false);

  const update = (key: keyof typeof form) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setError(null);
  };

  const handleDateChange = (text: string) => {
    // Solo permitir números
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setForm((f) => ({ ...f, fechaNacimiento: formatted }));
    setError(null);
  };

  const passwordsMismatch = form.repetirPassword && form.password !== form.repetirPassword;

  const handleRegister = async () => {
    const { nombre, apellido, email, password, repetirPassword, telefono, provincia, localidad, fechaNacimiento } = form;

    if (!nombre || !apellido || !email || !password || !telefono || !provincia || !localidad || !fechaNacimiento) {
      setError('Completá todos los campos.');
      return;
    }

    // Validar formato DD/MM/AAAA
    const match = fechaNacimiento.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      setError('La fecha de nacimiento debe tener el formato DD/MM/AAAA.');
      return;
    }
    const dia = parseInt(match[1], 10);
    const mes = parseInt(match[2], 10);
    const anio = parseInt(match[3], 10);
    const currentYear = new Date().getFullYear();

    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || anio < 1920 || anio > currentYear - 14) {
      setError('Ingresá una fecha de nacimiento válida.');
      return;
    }

    if (password !== repetirPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    setLoading(true);
    setError(null);
    try {
      await register({ ...form, fechaNacimiento: fechaISO });
      setSuccess('¡Cuenta creada exitosamente! Ingresando...');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta. Verifica los datos.');
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
            <Image
              source={require('../../../assets/logo-violet.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <View style={[styles.badgeDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.badgeText, { color: '#059669' }]}>Plan 100% Gratis Disponible</Text>
          </View>
          <Text style={styles.title}>Comenzá a organizar tus clases</Text>
          <Text style={styles.subtitle}>
            Creá tu cuenta en menos de un minuto y llevá el control de tus cursos, asistencias y notas.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {error && <AlertMessage type="error" message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Registro con Google */}
          <GoogleButton
            label="Registrarse con Google"
            disabled={loading}
            onError={(msg) => { setSuccess(null); setError(msg); }}
            onSuccess={() => { setError(null); setSuccess('¡Cuenta lista! Ingresando...'); }}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o con tu email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            {/* Fila: Nombre + Apellido */}
            <View style={styles.row}>
              <View style={styles.col}>
                <AppInput label="Nombre" iconName="person-outline" placeholder="Juan"
                  value={form.nombre} onChangeText={update('nombre')} autoCapitalize="words" />
              </View>
              <View style={styles.col}>
                <AppInput label="Apellido" iconName="card-outline" placeholder="Pérez"
                  value={form.apellido} onChangeText={update('apellido')} autoCapitalize="words" />
              </View>
            </View>

            {/* Fila: Email + Teléfono */}
            <View style={styles.row}>
              <View style={styles.col}>
                <AppInput label="Email" iconName="mail-outline" placeholder="docente@email.com"
                  keyboardType="email-address" autoCapitalize="none"
                  value={form.email} onChangeText={update('email')} />
              </View>
              <View style={styles.col}>
                <AppInput label="Teléfono" iconName="call-outline" placeholder="11 1234-5678"
                  keyboardType="phone-pad" value={form.telefono} onChangeText={update('telefono')} />
              </View>
            </View>

            {/* Selector de Provincia */}
            <View>
              <Text style={styles.inputLabel}>PROVINCIA</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowProvincias(!showProvincias)}
                activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                <Text style={[styles.selectorText, !form.provincia && { color: COLORS.secondary }]}>
                  {form.provincia || 'Seleccioná tu provincia'}
                </Text>
                <Ionicons name={showProvincias ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.secondary} />
              </TouchableOpacity>

              {showProvincias && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {PROVINCIAS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.dropdownItem, form.provincia === p && styles.dropdownItemSelected]}
                      onPress={() => { update('provincia')(p); setShowProvincias(false); }}
                    >
                      <Text style={[styles.dropdownText, form.provincia === p && styles.dropdownTextSelected]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <AppInput label="Localidad" iconName="location-outline" placeholder="Ciudad o Barrio"
              value={form.localidad} onChangeText={update('localidad')} autoCapitalize="words" />

            <AppInput
              label="Fecha de Nacimiento"
              iconName="calendar-outline"
              placeholder="DD/MM/AAAA"
              value={form.fechaNacimiento}
              onChangeText={handleDateChange}
              keyboardType="numeric"
              maxLength={10}
            />

            {/* Fila: Password + Confirmar */}
            <View style={styles.row}>
              <View style={styles.col}>
                <AppInput label="Contraseña" iconName="lock-closed-outline" placeholder="Mín. 6 caracteres"
                  secureTextEntry={!showPass} value={form.password} onChangeText={update('password')}
                  rightIcon={showPass ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPass(!showPass)} />
              </View>
              <View style={styles.col}>
                <AppInput label="Confirmar" iconName="lock-closed-outline" placeholder="Repetí tu clave"
                  secureTextEntry={!showPass} value={form.repetirPassword} onChangeText={update('repetirPassword')}
                  error={Boolean(passwordsMismatch)} />
              </View>
            </View>
            {passwordsMismatch ? (
              <Text style={styles.mismatch}>Las contraseñas no coinciden.</Text>
            ) : null}
          </View>

          <AppButton
            label="Crear mi cuenta gratis"
            loading={loading}
            disabled={Boolean(passwordsMismatch)}
            onPress={handleRegister}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>¿Ya tenés cuenta?</Text>
            <View style={styles.dividerLine} />
          </View>

          <AppButton label="Iniciá sesión" variant="outline" onPress={() => navigation.navigate('Login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, padding: SPACING.xl, paddingBottom: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xl, gap: SPACING.sm },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logoImage: {
    width: 42,
    height: 42,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  badgeDot: { width: 7, height: 7, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.onSurface, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.secondary, textAlign: 'center', lineHeight: 20, maxWidth: 300, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl, gap: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20,
    elevation: 6, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  form: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.sm },
  col: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: COLORS.onSurface, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  selector: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  selectorText: { flex: 1, fontSize: 14, color: COLORS.onSurface, fontWeight: '500' },
  dropdown: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, maxHeight: 200, marginTop: 4,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 11 },
  dropdownItemSelected: { backgroundColor: COLORS.accentLight },
  dropdownText: { fontSize: 14, color: COLORS.onSurface, fontWeight: '500' },
  dropdownTextSelected: { color: COLORS.accent, fontWeight: '700' },
  mismatch: { fontSize: 12, color: COLORS.error, fontWeight: '700', marginTop: -8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.divider },
  dividerText: { fontSize: 11, color: COLORS.secondary, fontWeight: '700' },
});
