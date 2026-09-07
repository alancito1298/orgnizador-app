import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
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

const CONCEPTOS = [
  { key: 'presente_buen_concepto', emoji: '😊', label: 'Excelente', color: '#16a34a', bg: '#dcfce7' },
  { key: 'presente', emoji: '😐', label: 'Regular / Normal', color: '#4b5563', bg: '#f3f4f6' },
  { key: 'presente_mal_concepto', emoji: '😞', label: 'A Mejorar', color: '#d97706', bg: '#fef3c7' },
  { key: 'ausente', emoji: '❌', label: 'Ausente', color: '#dc2626', bg: '#fee2e2' },
];

export default function PasoConceptoModal({
  abierto,
  inscripciones,
  trimestre,
  onCerrar,
  onFinalizado,
}: Props) {
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);
  const hoyStr = new Date().toISOString().split('T')[0];

  const handleSeleccionar = (inscId: number, estado: string) => {
    setRespuestas((prev) => ({ ...prev, [inscId]: estado }));
  };

  const handleTodosBuenConcepto = () => {
    const m: Record<number, string> = {};
    inscripciones.forEach((i) => {
      m[i.id] = 'presente_buen_concepto';
    });
    setRespuestas(m);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const promesas = inscripciones.map(async (insc) => {
        const estado = respuestas[insc.id] || 'presente';
        return apiFetch('/asistencias', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            fecha: hoyStr,
            estado,
            trimestre,
            alumnoCursoId: insc.id,
          }),
        }).catch(() => null);
      });

      await Promise.all(promesas);
      Alert.alert('¡Concepto Guardado!', 'Se registraron los conceptos diarios de los alumnos.');
      onFinalizado();
      onCerrar();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los conceptos.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={s.headLeft}>
              <Text style={s.headEmoji}>😊</Text>
              <View>
                <Text style={s.title}>EVALUAR CONCEPTO</Text>
                <Text style={s.sub}>Registro actitudinal diario ({hoyStr})</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCerrar} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.todosBtn} onPress={handleTodosBuenConcepto} activeOpacity={0.8}>
            <Text style={s.todosBtnText}>⭐ Asignar a todos "Excelente 😊"</Text>
          </TouchableOpacity>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {inscripciones.map((insc) => {
              const seleccionado = respuestas[insc.id] || 'presente';

              return (
                <View key={insc.id} style={s.alumnoRow}>
                  <Text style={s.alumnoNombre} numberOfLines={1}>
                    {insc.alumno?.apellido}, {insc.alumno?.nombre}
                  </Text>

                  <View style={s.emojisGroup}>
                    {CONCEPTOS.map((c) => {
                      const isSel = seleccionado === c.key;

                      return (
                        <TouchableOpacity
                          key={c.key}
                          style={[
                            s.emojiBtn,
                            isSel && { backgroundColor: c.bg, borderColor: c.color, borderWidth: 2 },
                          ]}
                          onPress={() => handleSeleccionar(insc.id, c.key)}
                        >
                          <Text style={s.emojiChar}>{c.emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={s.actions}>
            <AppButton label="Cancelar" variant="outline" onPress={onCerrar} style={{ flex: 1 }} />
            <AppButton
              label={guardando ? 'Guardando...' : 'Guardar Conceptos'}
              onPress={handleGuardar}
              loading={guardando}
              style={{ flex: 1 }}
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
  headEmoji: { fontSize: 28 },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  sub: { fontSize: 11, color: COLORS.secondary },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todosBtn: {
    backgroundColor: '#ede9fe',
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todosBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  scroll: { maxHeight: 380 },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    gap: 10,
  },
  alumnoNombre: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  emojisGroup: { flexDirection: 'row', gap: 6 },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChar: { fontSize: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
});
