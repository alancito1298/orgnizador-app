import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../api/client';
import AppButton from '../ui/AppButton';
import { COLORS, RADIUS, SPACING } from '../../theme';

interface Inscripcion {
  id: number;
  alumnoId: number;
  cursoId: number;
  alumno: {
    id: number;
    nombre: string;
    apellido: string;
  };
}

interface Props {
  abierto: boolean;
  inscripciones: Inscripcion[];
  trimestre: number;
  onCerrar: () => void;
  onFinalizado: () => void;
}

type TipoEvaluacion = 'trabajo_practico' | 'Examen' | 'final';

const TIPOS: { key: TipoEvaluacion; label: string }[] = [
  { key: 'trabajo_practico', label: 'TP' },
  { key: 'Examen', label: 'Examen' },
  { key: 'final', label: 'Final' },
];

export default function PasoCalificacionModal({
  abierto,
  inscripciones,
  trimestre: trimestreProp,
  onCerrar,
  onFinalizado,
}: Props) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(hoyStr);
  const [tipo, setTipo] = useState<TipoEvaluacion>('trabajo_practico');
  const [trimestre, setTrimestre] = useState<number>(trimestreProp || 1);
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);

  const handleSetNota = (inscId: number, val: string) => {
    const clean = val.replace(',', '.');
    setNotas((prev) => ({ ...prev, [inscId]: clean }));
  };

  const handleGuardar = async () => {
    const validas = Object.entries(notas).filter(([, val]) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 1 && num <= 10;
    });

    if (validas.length === 0) {
      Alert.alert('Atención', 'Por favor ingresá al menos una nota válida (entre 1 y 10).');
      return;
    }

    setGuardando(true);
    try {
      const promesas = validas.map(async ([inscIdStr, valStr]) => {
        const alumnoCursoId = Number(inscIdStr);
        const valor = parseFloat(valStr);
        return apiFetch('/calificaciones', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            alumnoCursoId,
            valor,
            fecha: new Date(fecha + 'T12:00:00').toISOString(),
            tipo,
            trimestre,
          }),
        }).catch(() => null);
      });

      await Promise.all(promesas);
      Alert.alert('¡Éxito!', `Se registraron ${validas.length} calificaciones.`);
      setNotas({});
      onFinalizado();
      onCerrar();
    } catch {
      Alert.alert('Error', 'Ocurrió un problema al registrar las calificaciones.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Encabezado */}
          <View style={s.head}>
            <View style={s.headLeft}>
              <View style={s.iconBox}>
                <Ionicons name="create-outline" size={20} color={COLORS.accent} />
              </View>
              <View>
                <Text style={s.title}>CARGAR CALIFICACIONES</Text>
                <Text style={s.sub}>Registro de notas por evaluación</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCerrar} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {/* Selectores de Tipo y Trimestre */}
          <View style={s.selectorsRow}>
            <View style={s.selectorCol}>
              <Text style={s.selectorLabel}>Tipo de evaluación:</Text>
              <View style={s.pillsGroup}>
                {TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.pillBtn, tipo === t.key && s.pillBtnActive]}
                    onPress={() => setTipo(t.key)}
                  >
                    <Text style={[s.pillText, tipo === t.key && s.pillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.selectorCol}>
              <Text style={s.selectorLabel}>Trimestre:</Text>
              <View style={s.pillsGroup}>
                {[1, 2, 3].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[s.pillBtn, trimestre === num && s.pillBtnActive]}
                    onPress={() => setTrimestre(num)}
                  >
                    <Text style={[s.pillText, trimestre === num && s.pillTextActive]}>{num}°</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Lista de Alumnos */}
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {inscripciones.map((insc) => {
              const val = notas[insc.id] || '';
              const num = parseFloat(val);
              const esAprobado = !isNaN(num) && num >= 6;
              const esDesaprobado = !isNaN(num) && num < 6;

              return (
                <View key={insc.id} style={s.alumnoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alumnoNombre} numberOfLines={1}>
                      {insc.alumno?.apellido}, {insc.alumno?.nombre}
                    </Text>
                  </View>

                  {/* Input de nota */}
                  <View style={s.inputRow}>
                    <TextInput
                      style={[
                        s.notaInput,
                        esAprobado && s.notaInputAprobado,
                        esDesaprobado && s.notaInputDesaprobado,
                      ]}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={COLORS.secondary}
                      maxLength={4}
                      value={val}
                      onChangeText={(text) => handleSetNota(insc.id, text)}
                    />
                    {val ? (
                      <TouchableOpacity
                        onPress={() => handleSetNota(insc.id, '')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Botones de acción */}
          <View style={s.actions}>
            <AppButton label="Cancelar" variant="outline" onPress={onCerrar} style={{ flex: 1 }} />
            <AppButton
              label={guardando ? 'Guardando...' : 'Guardar Calificaciones'}
              onPress={handleGuardar}
              loading={guardando}
              style={{ flex: 1.4 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    gap: SPACING.md,
    maxHeight: '85%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface },
  sub: { fontSize: 11, color: COLORS.secondary },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: '#f9fafb',
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  selectorCol: { flex: 1, gap: 4 },
  selectorLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, textTransform: 'uppercase' },
  pillsGroup: { flexDirection: 'row', gap: 4 },
  pillBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: COLORS.onSurface },
  pillTextActive: { color: '#fff' },
  scroll: { maxHeight: 380 },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    gap: 12,
  },
  alumnoNombre: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notaInput: {
    width: 52,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  notaInputAprobado: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    color: '#047857',
  },
  notaInputDesaprobado: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    color: '#b91c1c',
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
});
