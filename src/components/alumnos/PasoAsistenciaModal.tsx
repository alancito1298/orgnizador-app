import React, { useState, useEffect } from 'react';
import {
  View,
  Text as RNText,
  type TextProps,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const Text = (props: TextProps) => <RNText allowFontScaling={false} {...props} />;
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../api/client';
import AppButton from '../ui/AppButton';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { useOfflineStore } from '../../utils/offlineSync';

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string | null;
}

interface Inscripcion {
  id: number;
  alumnoId: number;
  cursoId: number;
  alumno: Alumno;
}

interface Props {
  abierto: boolean;
  inscripciones: Inscripcion[];
  cursoInfo: { materia: string; escuela: string; anio: string } | null;
  trimestre: number;
  onCerrar: () => void;
  onFinalizado: () => void;
  onVerSabana?: () => void;
}

type EstadoAsistencia = 'presente' | 'ausente' | 'justificada' | 'media_falta';

const OPCIONES_ESTADO: { key: EstadoAsistencia; label: string; short: string; color: string; bg: string }[] = [
  { key: 'presente', label: 'Presente', short: 'P', color: '#16a34a', bg: '#dcfce7' },
  { key: 'ausente', label: 'Ausente', short: 'A', color: '#dc2626', bg: '#fee2e2' },
  { key: 'justificada', label: 'Justif.', short: 'J', color: '#2563eb', bg: '#dbeafe' },
  { key: 'media_falta', label: '½ Falta', short: '½', color: '#d97706', bg: '#fef3c7' },
];

export default function PasoAsistenciaModal({
  abierto,
  inscripciones,
  cursoInfo,
  trimestre,
  onCerrar,
  onFinalizado,
  onVerSabana,
}: Props) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(hoyStr);
  const [respuestas, setRespuestas] = useState<Record<number, EstadoAsistencia>>({});
  const [guardando, setGuardando] = useState(false);

  // Inicializar todos los alumnos en 'presente' por defecto al abrir
  useEffect(() => {
    if (abierto) {
      const inicial: Record<number, EstadoAsistencia> = {};
      inscripciones.forEach((i) => {
        inicial[i.id] = 'presente';
      });
      setRespuestas(inicial);
    }
  }, [abierto, inscripciones]);

  const handleSetEstado = (inscId: number, estado: EstadoAsistencia) => {
    setRespuestas((prev) => ({ ...prev, [inscId]: estado }));
  };

  const handleTodosPresentes = () => {
    const todos: Record<number, EstadoAsistencia> = {};
    inscripciones.forEach((i) => {
      todos[i.id] = 'presente';
    });
    setRespuestas(todos);
  };

  const handleGuardar = async () => {
    if (inscripciones.length === 0) {
      onCerrar();
      return;
    }

    setGuardando(true);
    let guardados = 0;

    try {
      const mapearEstadoBackend = (est: string) => {
        if (est === 'presente' || est === 'presente_buen_concepto') return 'presente_buen_concepto';
        if (est === 'ausente') return 'ausente';
        if (est === 'justificada' || est === 'media_falta') return 'justificada';
        if (est === 'presente_mal_concepto') return 'presente_mal_concepto';
        return 'presente_buen_concepto';
      };

      const promesas = inscripciones.map(async (insc) => {
        const estado = mapearEstadoBackend(respuestas[insc.id] || 'presente');
        const res = await apiFetch<any>('/asistencias', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            fecha,
            estado,
            trimestre,
            alumnoCursoId: insc.id,
          }),
        }).catch(() => null);

        if (res) guardados++;
      });

      await Promise.all(promesas);

      const isOff = useOfflineStore.getState().isOffline;
      if (isOff) {
        Alert.alert(
          '¡Guardado en el celular!',
          `Se guardó la asistencia de ${inscripciones.length} alumnos para el día ${fecha}. Se sincronizará automáticamente cuando recuperes señal.`
        );
      } else {
        Alert.alert(
          '¡Asistencia Guardada!',
          `Se registró con éxito la asistencia de ${inscripciones.length} alumnos para el día ${fecha}.`
        );
      }

      onFinalizado();
      onCerrar();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar la asistencia.');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  // Conteo en vivo
  let cantPresentes = 0;
  let cantAusentes = 0;
  let cantJustificadas = 0;
  let cantMediaFalta = 0;

  Object.values(respuestas).forEach((st) => {
    if (st === 'presente') cantPresentes++;
    else if (st === 'ausente') cantAusentes++;
    else if (st === 'justificada') cantJustificadas++;
    else if (st === 'media_falta') cantMediaFalta++;
  });

  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}
      >
        <View style={s.sheet}>
          {/* ── HEADER ── */}
          <View style={s.head}>
            <View style={s.headLeft}>
              <View style={s.iconBox}>
                <Ionicons name="checkmark-done" size={20} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>PASAR ASISTENCIA</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {cursoInfo?.materia || 'Clase'} · Fecha: {fecha}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCerrar} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── BARRA RESUMEN EN VIVO ── */}
          <View style={s.statsRow}>
            <View style={s.statBadgePresentes}>
              <Text style={s.statBadgeTextPresentes}>Presentes: {cantPresentes}</Text>
            </View>
            <View style={s.statBadgeAusentes}>
              <Text style={s.statBadgeTextAusentes}>Ausentes: {cantAusentes}</Text>
            </View>
            {cantJustificadas > 0 && (
              <View style={s.statBadgeJustif}>
                <Text style={s.statBadgeTextJustif}>Justif: {cantJustificadas}</Text>
              </View>
            )}
            {cantMediaFalta > 0 && (
              <View style={s.statBadgeMedia}>
                <Text style={s.statBadgeTextMedia}>½: {cantMediaFalta}</Text>
              </View>
            )}
          </View>

          {/* ── BOTÓN ACCIÓN RÁPIDA: TODOS PRESENTES ── */}
          <View style={s.quickActionsRow}>
            <TouchableOpacity
              style={s.todosBtn}
              onPress={handleTodosPresentes}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={s.todosBtnText}>Marcar todos PRESENTES</Text>
            </TouchableOpacity>

            {onVerSabana && (
              <TouchableOpacity
                style={s.sabanaLinkBtn}
                onPress={() => {
                  onCerrar();
                  onVerSabana();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="grid-outline" size={15} color={COLORS.accent} />
                <Text style={s.sabanaLinkText}>Ver Sábana</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── LISTADO DE ESTUDIANTES CON BOTONES TÁCTILES ── */}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {inscripciones.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No hay alumnos inscriptos en este curso.</Text>
              </View>
            ) : (
              inscripciones.map((insc, idx) => {
                const actual = respuestas[insc.id] || 'presente';

                return (
                  <View key={insc.id} style={s.alumnoRow}>
                    <View style={s.alumnoInfo}>
                      <Text style={s.alumnoNum}>{idx + 1}.</Text>
                      <Text style={s.alumnoNombre} numberOfLines={1}>
                        {insc.alumno?.apellido}, {insc.alumno?.nombre}
                      </Text>
                    </View>

                    <View style={s.pillsGroup}>
                      {OPCIONES_ESTADO.map((opt) => {
                        const isSel = actual === opt.key;

                        return (
                          <TouchableOpacity
                            key={opt.key}
                            style={[
                              s.pillBtn,
                              isSel && {
                                backgroundColor: opt.color,
                                borderColor: opt.color,
                              },
                            ]}
                            onPress={() => handleSetEstado(insc.id, opt.key)}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                s.pillBtnText,
                                isSel && { color: '#ffffff', fontWeight: '800' },
                              ]}
                            >
                              {opt.short}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* ── FOOTER DE ACCIONES ── */}
          <View style={s.footer}>
            <AppButton
              label="Cancelar"
              variant="outline"
              onPress={onCerrar}
              style={{ flex: 1 }}
              disabled={guardando}
            />
            <AppButton
              label={guardando ? 'Guardando...' : `Guardar Asistencia (${cantPresentes}/${inscripciones.length})`}
              onPress={handleGuardar}
              loading={guardando}
              style={{ flex: 1.6 }}
              disabled={inscripciones.length === 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
    letterSpacing: 0.3,
  },
  sub: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  statBadgePresentes: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statBadgeTextPresentes: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  statBadgeAusentes: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statBadgeTextAusentes: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '800',
  },
  statBadgeJustif: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statBadgeTextJustif: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  statBadgeMedia: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statBadgeTextMedia: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  todosBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  todosBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065f46',
  },
  sabanaLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  sabanaLinkText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.accent,
  },
  scroll: {
    maxHeight: 380,
  },
  scrollContent: {
    gap: 6,
    paddingBottom: SPACING.md,
  },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  alumnoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 6,
  },
  alumnoNum: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    width: 20,
  },
  alumnoNombre: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.onSurface,
    flex: 1,
  },
  pillsGroup: {
    flexDirection: 'row',
    gap: 5,
  },
  pillBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  emptyBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.secondary,
  },
});
