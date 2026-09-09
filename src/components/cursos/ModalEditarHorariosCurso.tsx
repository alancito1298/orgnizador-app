import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiFetch } from '../../api/client';
import AppInput from '../ui/AppInput';
import AppButton from '../ui/AppButton';
import AlertMessage from '../ui/AlertMessage';
import { COLORS, RADIUS, SPACING } from '../../theme';

export interface CursoInfo {
  id: number;
  escuela: string;
  anio: string;
  materia: string;
}

export interface HorarioItemEdit {
  id?: number;
  dia: string;
  hora: string;
}

const DIAS_OPCIONES = [
  { key: 'Lunes', label: 'LUN', full: 'Lunes' },
  { key: 'Martes', label: 'MAR', full: 'Martes' },
  { key: 'Miercoles', label: 'MIÉ', full: 'Miércoles' },
  { key: 'Jueves', label: 'JUE', full: 'Jueves' },
  { key: 'Viernes', label: 'VIE', full: 'Viernes' },
];

const HORARIOS_PREDEFINIDOS = [
  '08:00 a 09:20',
  '09:30 a 10:50',
  '11:00 a 12:20',
  '13:30 a 14:50',
  '15:00 a 16:20',
  '18:00 a 19:20',
  '20:00 a 21:00',
  '21:00 a 22:00',
];

function normalizarDia(dia: string | null | undefined): string {
  if (!dia) return 'Lunes';
  const clean = dia.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.startsWith('lun')) return 'Lunes';
  if (clean.startsWith('mar')) return 'Martes';
  if (clean.startsWith('mie')) return 'Miercoles';
  if (clean.startsWith('jue')) return 'Jueves';
  if (clean.startsWith('vie')) return 'Viernes';
  return 'Lunes';
}

function formatAnio(anio: string | undefined | null): string {
  if (!anio) return '';
  const str = String(anio).trim();
  if (str.includes('°')) return str;
  const match = str.match(/^(\d+)\s*(.*)$/);
  if (match) {
    const num = match[1];
    let resto = match[2].trim();
    resto = resto.replace(/^(er|do|ro|to|mo|vo|no|ero)\b/i, '').trim();
    if (!resto || /^(a[ñn]o|grado)$/i.test(resto)) {
      return `${num}°`;
    }
    return `${num}° ${resto}`;
  }
  return `${str}°`;
}

interface ModalEditarHorariosCursoProps {
  visible: boolean;
  curso: CursoInfo | null;
  onClose: () => void;
  onGuardado?: () => void;
}

export default function ModalEditarHorariosCurso({
  visible,
  curso,
  onClose,
  onGuardado,
}: ModalEditarHorariosCursoProps) {
  const [horarios, setHorarios] = useState<HorarioItemEdit[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar los horarios actuales del curso al abrir el modal
  useEffect(() => {
    if (!visible || !curso) return;

    let cancelado = false;

    async function cargarHorariosDelCurso() {
      setCargando(true);
      setError(null);
      try {
        const data = await apiFetch<any[]>('/horarios', { auth: true });
        if (cancelado) return;

        const rawList = Array.isArray(data) ? data : [];
        const matNorm = (curso?.materia || '').trim().toLowerCase();
        const escNorm = (curso?.escuela || '').trim().toLowerCase();

        const delCurso = rawList.filter((h) => {
          if (!h.descripcion) return false;
          try {
            const p = JSON.parse(h.descripcion);
            if (p.cursoId && Number(p.cursoId) === Number(curso?.id)) return true;
            return (p.materia || '').trim().toLowerCase() === matNorm;
          } catch {
            const lower = h.descripcion.toLowerCase();
            return (
              (matNorm && lower.includes(matNorm)) ||
              (escNorm && lower.includes(escNorm))
            );
          }
        });

        if (delCurso.length > 0) {
          const parseados = delCurso.map((h) => ({
            id: h.id,
            dia: normalizarDia(h.dia),
            hora: (h.hora || '').replace(/\s+/g, ' ').trim(),
          }));
          setHorarios(parseados);
        } else {
          // Si no tiene horarios asignados, iniciar con uno por defecto
          setHorarios([{ dia: 'Lunes', hora: '08:00 a 09:20' }]);
        }
      } catch (e: any) {
        if (!cancelado) {
          console.error('[ModalEditarHorarios] Error al cargar:', e);
          setError('No se pudieron cargar los horarios actuales.');
          setHorarios([{ dia: 'Lunes', hora: '08:00 a 09:20' }]);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarHorariosDelCurso();

    return () => {
      cancelado = true;
    };
  }, [visible, curso]);

  const agregarDia = () => {
    const diasAsignados = horarios.map((h) => h.dia);
    const siguiente =
      DIAS_OPCIONES.find((d) => !diasAsignados.includes(d.key))?.key || 'Miercoles';
    const ultimaHora = horarios[horarios.length - 1]?.hora || '08:00 a 09:20';

    setHorarios((prev) => [...prev, { dia: siguiente, hora: ultimaHora }]);
  };

  const quitarDia = (index: number) => {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
  };

  const cambiarDia = (index: number, nuevoDia: string) => {
    setHorarios((prev) =>
      prev.map((item, i) => (i === index ? { ...item, dia: nuevoDia } : item))
    );
  };

  const cambiarHora = (index: number, nuevaHora: string) => {
    setHorarios((prev) =>
      prev.map((item, i) => (i === index ? { ...item, hora: nuevaHora } : item))
    );
  };

  const guardar = async () => {
    if (!curso) return;

    // Validar que los horarios ingresados tengan texto
    const vacios = horarios.some((h) => !h.hora.trim());
    if (vacios) {
      setError('Por favor completá la franja horaria de todos los días agregados.');
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      // 1. Obtener los horarios actuales de la base de datos para borrar los de este curso
      const allHorarios = await apiFetch<any[]>('/horarios', { auth: true }).catch(() => []);
      const matNorm = curso.materia.trim().toLowerCase();
      const escNorm = curso.escuela.trim().toLowerCase();

      if (Array.isArray(allHorarios)) {
        const aBorrar = allHorarios.filter((h) => {
          if (!h.descripcion) return false;
          try {
            const p = JSON.parse(h.descripcion);
            if (p.cursoId && Number(p.cursoId) === Number(curso.id)) return true;
            return (p.materia || '').trim().toLowerCase() === matNorm;
          } catch {
            const lower = h.descripcion.toLowerCase();
            return (
              (matNorm && lower.includes(matNorm)) ||
              (escNorm && lower.includes(escNorm))
            );
          }
        });

        if (aBorrar.length > 0) {
          await Promise.allSettled(
            aBorrar.map((h) =>
              apiFetch(`/horarios/${h.id}`, { method: 'DELETE', auth: true })
            )
          );
        }
      }

      // 2. Crear los nuevos horarios configurados
      if (horarios.length > 0) {
        const desc = JSON.stringify({
          materia: curso.materia.trim(),
          curso: String(curso.anio).trim(),
          escuela: curso.escuela.trim(),
          cursoId: curso.id,
        });

        await Promise.all(
          horarios.map((h) =>
            apiFetch('/horarios', {
              method: 'POST',
              auth: true,
              body: JSON.stringify({
                dia: h.dia,
                hora: h.hora.trim(),
                descripcion: desc,
              }),
            })
          )
        );
      }

      Alert.alert(
        '¡Horarios actualizados!',
        `Se configuraron correctamente ${horarios.length} ${
          horarios.length === 1 ? 'día de cursada' : 'días de cursada'
        } para ${curso.materia}.`
      );

      onGuardado?.();
      onClose();
    } catch (e: any) {
      console.error('[ModalEditarHorarios] Error al guardar:', e);
      setError(e.message || 'No se pudieron guardar los horarios del curso.');
    } finally {
      setGuardando(false);
    }
  };

  if (!curso) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={m.overlay}
      >
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <View style={m.headerLeft}>
              <View style={m.iconBox}>
                <Ionicons name="time-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.title}>EDITAR HORARIOS Y DÍAS</Text>
                <Text style={m.subtitle} numberOfLines={1}>
                  {curso.materia} · {formatAnio(curso.anio)}
                </Text>
                <Text style={m.escuelaText} numberOfLines={1}>
                  {curso.escuela}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={m.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          <ScrollView
            style={m.scroll}
            contentContainerStyle={m.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error && <AlertMessage type="error" message={error} />}

            {cargando ? (
              <View style={m.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={m.loadingText}>Cargando horarios actuales...</Text>
              </View>
            ) : (
              <>
                <View style={m.infoBanner}>
                  <Ionicons name="information-circle-outline" size={18} color={COLORS.accent} />
                  <Text style={m.infoBannerText}>
                    Definí qué días y en qué horarios dictás esta materia. Se reflejarán
                    automáticamente en tu cronograma semanal.
                  </Text>
                </View>

                {horarios.map((item, idx) => (
                  <View key={idx} style={m.diaCard}>
                    {/* Cabecera del día */}
                    <View style={m.diaHeader}>
                      <View style={m.diaBadge}>
                        <Ionicons name="calendar" size={13} color={COLORS.accent} />
                        <Text style={m.diaBadgeText}>DÍA DE CURSADA #{idx + 1}</Text>
                      </View>
                      {horarios.length > 1 && (
                        <TouchableOpacity
                          style={m.quitarBtn}
                          onPress={() => quitarDia(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#ef4444" />
                          <Text style={m.quitarText}>Quitar</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Selector de día */}
                    <Text style={m.fieldLabel}>SELECCIONAR DÍA:</Text>
                    <View style={m.chipsRow}>
                      {DIAS_OPCIONES.map((d) => {
                        const isSelected = item.dia === d.key;
                        return (
                          <TouchableOpacity
                            key={d.key}
                            style={[m.chip, isSelected && m.chipActive]}
                            onPress={() => cambiarDia(idx, d.key)}
                            activeOpacity={0.7}
                          >
                            <Text style={[m.chipText, isSelected && m.chipTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Franja horaria */}
                    <Text style={[m.fieldLabel, { marginTop: SPACING.sm }]}>FRANJA HORARIA:</Text>
                    <AppInput
                      label=""
                      iconName="time-outline"
                      placeholder="Ej. 08:00 a 09:20"
                      value={item.hora}
                      onChangeText={(txt) => cambiarHora(idx, txt)}
                    />

                    {/* Atajos rápidos de hora */}
                    <Text style={m.shortcutsLabel}>Atajos frecuentes:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={m.shortcutsRow}
                    >
                      {HORARIOS_PREDEFINIDOS.map((hPre) => {
                        const esActual = item.hora.trim() === hPre;
                        return (
                          <TouchableOpacity
                            key={hPre}
                            style={[m.shortcutChip, esActual && m.shortcutChipActive]}
                            onPress={() => cambiarHora(idx, hPre)}
                            activeOpacity={0.7}
                          >
                            <Text style={[m.shortcutText, esActual && m.shortcutTextActive]}>
                              {hPre}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ))}

                {/* Botón agregar otro día */}
                <TouchableOpacity style={m.addDiaBtn} onPress={agregarDia} activeOpacity={0.8}>
                  <Ionicons name="add-circle" size={20} color={COLORS.accent} />
                  <Text style={m.addDiaText}>+ Agregar otro día de cursada</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {/* Footer con botones */}
          <View style={m.footer}>
            <AppButton
              label="Cancelar"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={guardando}
            />
            <AppButton
              label={guardando ? 'Guardando...' : 'Guardar Horarios'}
              loading={guardando}
              onPress={guardar}
              style={{ flex: 1.4 }}
              disabled={cargando}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
    minHeight: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.onSurface,
    marginTop: 1,
  },
  escuelaText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#5b21b6',
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
  diaCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.18)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  diaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  diaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  diaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  quitarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  quitarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  shortcutsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 2,
    marginBottom: 4,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
  },
  shortcutChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shortcutChipActive: {
    backgroundColor: '#ede9fe',
    borderColor: COLORS.accent,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  shortcutTextActive: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  addDiaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.3)',
    borderStyle: 'dashed',
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    marginTop: 4,
  },
  addDiaText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
});
