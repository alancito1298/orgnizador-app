import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiFetch } from '../../api/client';
import AppInput from '../ui/AppInput';
import AppButton from '../ui/AppButton';
import AlertMessage from '../ui/AlertMessage';
import { COLORS, RADIUS, SPACING } from '../../theme';

export interface Curso {
  id: number;
  escuela: string;
  anio: string;
  materia: string;
  ruta: string;
}

export interface HorarioExtra {
  dia: string;
  hora: string;
}

const DIAS_OPCIONES = [
  { key: 'Lunes', label: 'LUN' },
  { key: 'Martes', label: 'MAR' },
  { key: 'Miercoles', label: 'MIÉ' },
  { key: 'Jueves', label: 'JUE' },
  { key: 'Viernes', label: 'VIE' },
];

interface ModalCrearCursoProps {
  visible: boolean;
  onClose: () => void;
  onCreado: (curso: Curso) => void;
}

export default function ModalCrearCurso({
  visible,
  onClose,
  onCreado,
}: ModalCrearCursoProps) {
  const [anio, setAnio] = useState('');
  const [escuela, setEscuela] = useState('');
  const [materia, setMateria] = useState('');
  const [asignarHorario, setAsignarHorario] = useState(true);
  const [diaPrincipal, setDiaPrincipal] = useState('Lunes');
  const [horaPrincipal, setHoraPrincipal] = useState('08:00 a 09:20');
  const [horariosExtra, setHorariosExtra] = useState<HorarioExtra[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setAnio('');
    setEscuela('');
    setMateria('');
    setAsignarHorario(true);
    setDiaPrincipal('Lunes');
    setHoraPrincipal('08:00 a 09:20');
    setHorariosExtra([]);
    setError(null);
    setGuardando(false);
  };

  const agregarDiaExtra = () => {
    // Buscar el siguiente día no asignado o fallback a 'Miercoles'
    const asignados = [diaPrincipal, ...horariosExtra.map((h) => h.dia)];
    const siguiente =
      DIAS_OPCIONES.find((d) => !asignados.includes(d.key))?.key || 'Miercoles';

    setHorariosExtra((prev) => [
      ...prev,
      { dia: siguiente, hora: horaPrincipal || '10:00 a 11:20' },
    ]);
  };

  const guardar = async () => {
    if (!anio.trim() || !escuela.trim() || !materia.trim()) {
      setError('Completá año, institución y materia.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const data = await apiFetch<Curso>('/cursos', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          escuela: escuela.trim(),
          anio: anio.trim(),
          materia: materia.trim(),
        }),
      });

      if (asignarHorario && data.id) {
        const lista: HorarioExtra[] = [];
        if (horaPrincipal.trim()) {
          lista.push({ dia: diaPrincipal, hora: horaPrincipal.trim() });
        }
        horariosExtra.forEach((h) => {
          if (h.hora.trim()) lista.push(h);
        });

        if (lista.length > 0) {
          const desc = JSON.stringify({
            materia: materia.trim(),
            curso: anio.trim(),
            escuela: escuela.trim(),
            cursoId: data.id,
          });
          await Promise.allSettled(
            lista.map((h) =>
              apiFetch('/horarios', {
                method: 'POST',
                auth: true,
                body: JSON.stringify({
                  dia: h.dia,
                  hora: h.hora,
                  descripcion: desc,
                }),
              })
            )
          );
        }
      }

      onCreado(data);
      reset();
      onClose();
    } catch (e: any) {
      setError(e.message || 'No se pudo crear el curso');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={mc.overlay}
      >
        <View style={mc.sheet}>
          {/* Header */}
          <View style={mc.header}>
            <View style={mc.headerLeft}>
              <View style={mc.iconBox}>
                <Ionicons name="school-outline" size={20} color={COLORS.accent} />
              </View>
              <View>
                <Text style={mc.title}>NUEVO CURSO</Text>
                <Text style={mc.subtitle}>Configurá los datos y horarios del aula</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                reset();
                onClose();
              }}
              style={mc.closeBtn}
            >
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={mc.scrollContent}
          >
            {error && <AlertMessage type="error" message={error} />}

            <View style={mc.fields}>
              <AppInput
                label="Año o División *"
                iconName="layers-outline"
                placeholder="Ej. 1° Año, 2° 1ra"
                value={anio}
                onChangeText={setAnio}
              />
              <AppInput
                label="Institución / Escuela *"
                iconName="business-outline"
                placeholder="Ej. E.E.S. N° 5, Normal 1"
                value={escuela}
                onChangeText={setEscuela}
                autoCapitalize="words"
              />
              <AppInput
                label="Materia *"
                iconName="book-outline"
                placeholder="Ej. Matemática, Historia"
                value={materia}
                onChangeText={setMateria}
                autoCapitalize="words"
              />
            </View>

            {/* Sección Horarios */}
            <View style={mc.horarioSection}>
              <View style={mc.horarioHeader}>
                <View style={{ flex: 1 }}>
                  <View style={mc.horarioTitleRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.accent} />
                    <Text style={mc.horarioTitle}>HORARIOS EN LA GRILLA</Text>
                  </View>
                  <Text style={mc.horarioSub}>Se vincularán automáticamente al horario.</Text>
                </View>
                <View style={mc.switchRow}>
                  <Text style={mc.switchLabel}>Activo</Text>
                  <Switch
                    value={asignarHorario}
                    onValueChange={setAsignarHorario}
                    trackColor={{ false: '#e5e7eb', true: COLORS.accentLight }}
                    thumbColor={asignarHorario ? COLORS.accent : '#d1d5db'}
                  />
                </View>
              </View>

              {asignarHorario && (
                <View style={mc.horarioBox}>
                  {/* Día Principal */}
                  <View style={mc.diaBlock}>
                    <Text style={mc.fieldSublabel}>DÍA DE CURSADA:</Text>
                    <View style={mc.chipsRow}>
                      {DIAS_OPCIONES.map((d) => {
                        const isSelected = diaPrincipal === d.key;
                        return (
                          <TouchableOpacity
                            key={d.key}
                            style={[mc.chip, isSelected && mc.chipActive]}
                            onPress={() => setDiaPrincipal(d.key)}
                            activeOpacity={0.7}
                          >
                            <Text style={[mc.chipText, isSelected && mc.chipTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[mc.fieldSublabel, { marginTop: 10 }]}>FRANJA HORARIA:</Text>
                    <AppInput
                      label=""
                      iconName="time-outline"
                      placeholder="Ej. 08:00 a 09:20"
                      value={horaPrincipal}
                      onChangeText={setHoraPrincipal}
                    />
                  </View>

                  {/* Días adicionales */}
                  {horariosExtra.map((extra, idx) => (
                    <View key={idx} style={mc.extraCard}>
                      <View style={mc.extraCardHeader}>
                        <View style={mc.extraBadge}>
                          <Ionicons name="calendar-outline" size={13} color={COLORS.accent} />
                          <Text style={mc.extraBadgeText}>DÍA ADICIONAL #{idx + 1}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            setHorariosExtra((prev) => prev.filter((_, i) => i !== idx))
                          }
                          style={mc.removeExtraBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                          <Text style={mc.removeExtraText}>Quitar</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={mc.fieldSublabel}>DÍA:</Text>
                      <View style={mc.chipsRow}>
                        {DIAS_OPCIONES.map((d) => {
                          const isSelected = extra.dia === d.key;
                          return (
                            <TouchableOpacity
                              key={d.key}
                              style={[mc.chip, isSelected && mc.chipActive]}
                              onPress={() =>
                                setHorariosExtra((prev) =>
                                  prev.map((h, i) => (i === idx ? { ...h, dia: d.key } : h))
                                )
                              }
                              activeOpacity={0.7}
                            >
                              <Text style={[mc.chipText, isSelected && mc.chipTextActive]}>
                                {d.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={[mc.fieldSublabel, { marginTop: 10 }]}>FRANJA HORARIA:</Text>
                      <AppInput
                        label=""
                        iconName="time-outline"
                        placeholder="Ej. 10:00 a 11:20"
                        value={extra.hora}
                        onChangeText={(v) =>
                          setHorariosExtra((prev) =>
                            prev.map((h, i) => (i === idx ? { ...h, hora: v } : h))
                          )
                        }
                      />
                    </View>
                  ))}

                  {/* Botón agregar otro día */}
                  <TouchableOpacity
                    style={mc.addDiaBtn}
                    onPress={agregarDiaExtra}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={18} color={COLORS.accent} />
                    <Text style={mc.addDiaText}>+ Agregar otro día de cursada</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Acciones */}
          <View style={mc.actions}>
            <AppButton
              label="Cancelar"
              variant="outline"
              onPress={() => {
                reset();
                onClose();
              }}
              style={{ flex: 1 }}
            />
            <AppButton
              label="Guardar Curso"
              loading={guardando}
              onPress={guardar}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mc = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.5 },
  subtitle: { fontSize: 11, color: COLORS.secondary, fontWeight: '500', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: SPACING.md,
  },
  fields: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  horarioSection: {
    marginBottom: SPACING.md,
  },
  horarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  horarioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  horarioTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  horarioSub: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  horarioBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
  },
  diaBlock: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.08)',
  },
  fieldSublabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  extraCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  extraCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  extraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  extraBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  removeExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fee2e2',
  },
  removeExtraText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  addDiaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
  },
  addDiaText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
