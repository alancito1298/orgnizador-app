import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'] as const;
type Dia = typeof DIAS[number];

const DIAS_LABEL: Record<Dia, string> = {
  Lunes: 'Lunes',
  Martes: 'Martes',
  Miercoles: 'Miércoles',
  Jueves: 'Jueves',
  Viernes: 'Viernes',
};

const DIAS_ABREV: Record<Dia, string> = {
  Lunes: 'LUN',
  Martes: 'MAR',
  Miercoles: 'MIÉ',
  Jueves: 'JUE',
  Viernes: 'VIE',
};

interface HorarioItem {
  id: number;
  dia: Dia;
  hora: string;
  descripcion: string | null;
}

interface HorarioParseado {
  id: number;
  dia: Dia;
  hora: string;
  materia: string;
  curso: string;
  escuela: string;
  cursoId?: number | null;
}

interface Curso {
  id: number;
  materia: string;
  anio: string;
  escuela: string;
}

function parsearDesc(desc: string | null | undefined): { materia: string; curso: string; escuela: string; cursoId?: number | null } {
  if (!desc) return { materia: 'Clase', curso: '', escuela: '', cursoId: null };
  try {
    const p = JSON.parse(desc);
    return {
      materia: p.materia || 'Clase',
      curso: p.curso || '',
      escuela: p.escuela || '',
      cursoId: p.cursoId ? Number(p.cursoId) : null,
    };
  } catch {
    return { materia: desc, curso: '', escuela: '', cursoId: null };
  }
}

export default function HorariosScreen() {
  const navigation = useNavigation<Nav>();

  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [diaActivo, setDiaActivo] = useState<Dia>('Lunes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Agregar
  const [modalAgregar, setModalAgregar] = useState(false);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('09:20');
  const [materiaInput, setMateriaInput] = useState('');
  const [cursoInput, setCursoInput] = useState('');
  const [escuelaInput, setEscuelaInput] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Seleccionar automáticamente el día de hoy si es de L a V
  useEffect(() => {
    const diaNum = new Date().getDay();
    const mapa: Record<number, Dia> = { 1: 'Lunes', 2: 'Martes', 3: 'Miercoles', 4: 'Jueves', 5: 'Viernes' };
    if (mapa[diaNum]) {
      setDiaActivo(mapa[diaNum]);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [hRes, cRes] = await Promise.allSettled([
        apiFetch<HorarioItem[]>('/horarios', { auth: true }),
        apiFetch<Curso[]>('/cursos', { auth: true }),
      ]);

      if (hRes.status === 'fulfilled' && Array.isArray(hRes.value)) {
        setHorarios(hRes.value);
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) {
        setCursos(cRes.value);
      }
    } catch (e) {
      console.error('Error al cargar horarios:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const horariosParseados = useMemo(() => {
    return horarios.map((h): HorarioParseado => {
      const p = parsearDesc(h.descripcion);
      let cursoId = p.cursoId;
      if (!cursoId) {
        const found = cursos.find(
          (c) => c.materia.trim().toLowerCase() === p.materia.trim().toLowerCase()
        );
        if (found) cursoId = found.id;
      }
      return {
        id: h.id,
        dia: h.dia,
        hora: (h.hora || '').replace(/\s+/g, ' ').trim(),
        materia: p.materia,
        curso: p.curso,
        escuela: p.escuela,
        cursoId,
      };
    });
  }, [horarios, cursos]);

  // Clases del día seleccionado ordenadas por hora
  const clasesDelDia = useMemo(() => {
    return horariosParseados
      .filter((h) => h.dia === diaActivo)
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }, [horariosParseados, diaActivo]);

  const handleGuardarHorario = async () => {
    if (!materiaInput.trim()) {
      Alert.alert('Datos requeridos', 'Por favor ingresá la materia.');
      return;
    }
    setGuardando(true);
    try {
      const rangoHora = `${horaInicio.trim()} - ${horaFin.trim()}`;
      const descObj = {
        materia: materiaInput.trim(),
        curso: cursoInput.trim(),
        escuela: escuelaInput.trim(),
      };

      await apiFetch('/horarios', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          dia: diaActivo,
          hora: rangoHora,
          descripcion: JSON.stringify(descObj),
        }),
      });

      setMateriaInput('');
      setCursoInput('');
      setEscuelaInput('');
      setModalAgregar(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar el horario.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarHorario = (id: number) => {
    Alert.alert('¿Eliminar bloque horario?', 'Se quitará esta clase del cronograma semanal.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/horarios/${id}`, { method: 'DELETE', auth: true });
            fetchData();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar el horario.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Cargando horarios de clase...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── TOP NAV HEADER ── */}
      <View style={s.topNav}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={s.topNavTitle}>HORARIOS DE CLASE</Text>
        <TouchableOpacity
          style={s.nuevoHeaderBtn}
          onPress={() => setModalAgregar(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.nuevoHeaderText}>+ Bloque</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* ── ENCABEZADO GRILLA SEMANAL (Fiel al web Horario.tsx) ── */}
        <View style={s.webHeaderRow}>
          <View>
            <Text style={s.webHeaderTitle}>GRILLA SEMANAL</Text>
            <Text style={s.webHeaderSub}>Materia, curso y escuela por día</Text>
          </View>
        </View>

        {/* ── SELECTOR DE DÍAS (Estilo web pill neumorphic) ── */}
        <View style={s.diasBarCard}>
          <View style={s.diasPillsRow}>
            {DIAS.map((d) => {
              const isSel = diaActivo === d;
              const cantidad = horariosParseados.filter((h) => h.dia === d).length;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.diaPill, isSel && s.diaPillActive]}
                  onPress={() => setDiaActivo(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.diaPillAbrev, isSel && s.diaPillAbrevActive]}>{DIAS_ABREV[d]}</Text>
                  <View style={[s.diaPillCount, isSel && s.diaPillCountActive]}>
                    <Text style={[s.diaPillCountText, isSel && s.diaPillCountTextActive]}>{cantidad}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── LISTADO DE CLASES DEL DÍA ── */}
        <View style={s.clasesSection}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="time" size={16} color={COLORS.accent} />
              <Text style={s.sectionTitle}>
                CLASES DEL {DIAS_LABEL[diaActivo].toUpperCase()} ({clasesDelDia.length})
              </Text>
            </View>
          </View>

          {clasesDelDia.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="cafe-outline" size={44} color={COLORS.secondary} />
              <Text style={s.emptyTitle}>No hay clases para el {DIAS_LABEL[diaActivo]}</Text>
              <Text style={s.emptySub}>Tocá en "+ Bloque" para agregar una clase a este día.</Text>
            </View>
          ) : (
            clasesDelDia.map((c) => (
              <View key={c.id} style={s.claseCard}>
                <View style={s.claseCardTop}>
                  <View style={s.horaBox}>
                    <Ionicons name="time-outline" size={13} color={COLORS.accent} />
                    <Text style={s.horaText}>{c.hora}</Text>
                  </View>

                  {c.curso ? (
                    <View style={s.cursoBadge}>
                      <Text style={s.cursoBadgeText}>{c.curso}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={s.deleteClaseBtn}
                    onPress={() => handleEliminarHorario(c.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <Text style={s.materiaText} numberOfLines={1}>{c.materia}</Text>

                {c.escuela ? (
                  <View style={s.escuelaRow}>
                    <Ionicons name="business-outline" size={12} color={COLORS.secondary} />
                    <Text style={s.escuelaText} numberOfLines={1}>{c.escuela}</Text>
                  </View>
                ) : null}

                {c.cursoId ? (
                  <TouchableOpacity
                    style={s.irAlAulaBtn}
                    onPress={() => navigation.navigate('CursoDetalle', { cursoId: c.cursoId! })}
                    activeOpacity={0.8}
                  >
                    <Text style={s.irAlAulaText}>Ir al aula</Text>
                    <Ionicons name="arrow-forward" size={11} color={COLORS.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── MODAL AGREGAR HORARIO ── */}
      <Modal visible={modalAgregar} transparent animationType="slide" onRequestClose={() => setModalAgregar(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>+ Nueva Clase en {DIAS_LABEL[diaActivo]}</Text>
              <TouchableOpacity onPress={() => setModalAgregar(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={s.horaInputsRow}>
              <View style={{ flex: 1 }}>
                <AppInput label="Desde *" value={horaInicio} onChangeText={setHoraInicio} placeholder="08:00" />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput label="Hasta *" value={horaFin} onChangeText={setHoraFin} placeholder="09:20" />
              </View>
            </View>

            {/* Cursos existentes como chips rápidos */}
            {cursos.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.labelChips}>Autocompletar desde curso:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
                  {cursos.map((cu) => (
                    <TouchableOpacity
                      key={cu.id}
                      style={s.chipCurso}
                      onPress={() => {
                        setMateriaInput(cu.materia);
                        setCursoInput(cu.anio);
                        setEscuelaInput(cu.escuela);
                      }}
                    >
                      <Text style={s.chipCursoText}>{cu.materia} ({cu.anio}°)</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <AppInput label="Materia *" value={materiaInput} onChangeText={setMateriaInput} placeholder="Ej: Matemática" />
            <AppInput label="Año / División" value={cursoInput} onChangeText={setCursoInput} placeholder="Ej: 1° 2da" />
            <AppInput label="Escuela / Institución" value={escuelaInput} onChangeText={setEscuelaInput} placeholder="Ej: E.E.S. N°12" />

            <View style={m.actions}>
              <AppButton label="Cancelar" variant="outline" onPress={() => setModalAgregar(false)} style={{ flex: 1 }} />
              <AppButton label={guardando ? 'Guardando...' : 'Guardar Horario'} onPress={handleGuardarHorario} loading={guardando} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, textTransform: 'uppercase' },
  nuevoHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  nuevoHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  webHeaderRow: { marginBottom: SPACING.xs },
  webHeaderTitle: { fontSize: 22, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.3, textTransform: 'uppercase' },
  webHeaderSub: { fontSize: 12, color: COLORS.secondary, fontWeight: '500', marginTop: 2 },

  // Barra de Días
  diasBarCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  diasPillsRow: { flexDirection: 'row', gap: 4 },
  diaPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  diaPillActive: { backgroundColor: COLORS.accent },
  diaPillAbrev: { fontSize: 11, fontWeight: '800', color: COLORS.secondary },
  diaPillAbrevActive: { color: '#fff' },
  diaPillCount: {
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  diaPillCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  diaPillCountText: { fontSize: 9, fontWeight: '800', color: COLORS.accent },
  diaPillCountTextActive: { color: '#fff' },

  // Sección Clases
  clasesSection: { gap: SPACING.sm },
  sectionHeader: { marginBottom: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.secondary, letterSpacing: 0.5 },

  claseCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  claseCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  horaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  horaText: { fontSize: 11, fontWeight: '800', color: COLORS.accent },
  cursoBadge: {
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cursoBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.accent },
  deleteClaseBtn: { padding: 4 },
  materiaText: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface, textTransform: 'uppercase' },
  escuelaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  escuelaText: { fontSize: 11, color: COLORS.secondary, fontWeight: '500', flex: 1 },
  irAlAulaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    marginTop: 2,
  },
  irAlAulaText: { fontSize: 10, fontWeight: '800', color: COLORS.accent, textTransform: 'uppercase' },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 11, color: COLORS.secondary, textAlign: 'center' },

  horaInputsRow: { flexDirection: 'row', gap: SPACING.sm },
  labelChips: { fontSize: 11, fontWeight: '700', color: COLORS.secondary, marginBottom: 4 },
  chipCurso: {
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  chipCursoText: { fontSize: 10, fontWeight: '700', color: COLORS.accent },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    gap: SPACING.sm,
    maxHeight: '85%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
