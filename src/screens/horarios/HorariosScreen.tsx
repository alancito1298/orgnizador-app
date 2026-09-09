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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'] as const;
type Dia = typeof DIAS[number];
type TabDia = Dia | 'Todos';

const DIAS_LABEL: Record<TabDia, string> = {
  Todos: 'Toda la semana',
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
  dia: Dia | string;
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

function normalizarDia(dia: string | null | undefined): Dia {
  if (!dia) return 'Lunes';
  const clean = dia.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.startsWith('lun')) return 'Lunes';
  if (clean.startsWith('mar')) return 'Martes';
  if (clean.startsWith('mie')) return 'Miercoles';
  if (clean.startsWith('jue')) return 'Jueves';
  if (clean.startsWith('vie')) return 'Viernes';
  return 'Lunes';
}

function parsearDesc(
  desc: string | null | undefined,
  cursos: Curso[] = []
): { materia: string; curso: string; escuela: string; cursoId?: number | null } {
  if (!desc || !desc.trim()) return { materia: 'Clase', curso: '', escuela: '', cursoId: null };
  const raw = desc.trim();

  // 1. JSON estructurado
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) {
      return {
        materia: p.materia || 'Clase',
        curso: p.curso || '',
        escuela: p.escuela || '',
        cursoId: p.cursoId ? Number(p.cursoId) : null,
      };
    }
  } catch {
    // Texto plano
  }

  // 2. Coincidencia con cursos del docente (materia o escuela)
  const lower = raw.toLowerCase();
  const cursoEncontrado = cursos.find((c) => {
    const matNorm = (c.materia || '').trim().toLowerCase();
    const escNorm = (c.escuela || '').trim().toLowerCase();
    return (
      (matNorm && (matNorm === lower || lower.includes(matNorm) || matNorm.includes(lower))) ||
      (escNorm && (escNorm === lower || lower.includes(escNorm) || escNorm.includes(lower)))
    );
  });

  if (cursoEncontrado) {
    return {
      materia: cursoEncontrado.materia,
      curso: cursoEncontrado.anio,
      escuela: cursoEncontrado.escuela,
      cursoId: cursoEncontrado.id,
    };
  }

  // 3. Separado por guión
  const partes = raw.split(/\r?\n| - | — /);
  if (partes.length >= 2) {
    return {
      materia: partes[0].trim(),
      curso: partes[1].trim(),
      escuela: partes.slice(2).join(' ').trim(),
      cursoId: null,
    };
  }

  return { materia: raw, curso: '', escuela: '', cursoId: null };
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

export default function HorariosScreen() {
  const navigation = useNavigation<Nav>();

  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [diaActivo, setDiaActivo] = useState<TabDia>('Lunes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Agregar
  const [modalAgregar, setModalAgregar] = useState(false);
  const [diaModal, setDiaModal] = useState<Dia>('Lunes');
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
      setDiaModal(mapa[diaNum]);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      console.log('[HorariosScreen] fetchData starting...');
      const [hRes, cRes] = await Promise.allSettled([
        apiFetch<HorarioItem[]>('/horarios', { auth: true }),
        apiFetch<Curso[]>('/cursos', { auth: true }),
      ]);

      console.log('[HorariosScreen] hRes status:', hRes.status, hRes.status === 'fulfilled' ? hRes.value?.length : (hRes as any).reason);
      console.log('[HorariosScreen] cRes status:', cRes.status, cRes.status === 'fulfilled' ? cRes.value?.length : (cRes as any).reason);

      if (hRes.status === 'fulfilled' && Array.isArray(hRes.value)) {
        setHorarios(hRes.value);
        // Si el día seleccionado no tiene clases pero otros días sí,
        // seleccionar el primer día con clases para que el usuario no vea una grilla vacía
        const diasConClases = hRes.value.map((h) => normalizarDia(h.dia));
        setDiaActivo((prev) => {
          if (prev === 'Todos') return prev;
          if (diasConClases.includes(prev as Dia)) return prev;
          const primerDia = DIAS.find((d) => diasConClases.includes(d));
          return primerDia || prev;
        });
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) {
        setCursos(cRes.value);
      }
    } catch (e) {
      console.error('[HorariosScreen] Error al cargar horarios:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const horariosParseados = useMemo(() => {
    return horarios.map((h): HorarioParseado => {
      const p = parsearDesc(h.descripcion, cursos);
      let cursoId = p.cursoId;
      if (!cursoId) {
        const found = cursos.find(
          (c) => c.materia.trim().toLowerCase() === p.materia.trim().toLowerCase()
        );
        if (found) cursoId = found.id;
      }
      return {
        id: h.id,
        dia: normalizarDia(h.dia),
        hora: (h.hora || '').replace(/\s+/g, ' ').trim(),
        materia: p.materia,
        curso: p.curso,
        escuela: p.escuela,
        cursoId,
      };
    });
  }, [horarios, cursos]);

  // Clases del día seleccionado ordenadas por hora (o toda la semana si es Todos)
  const clasesDelDia = useMemo(() => {
    return horariosParseados
      .filter((h) => (diaActivo === 'Todos' ? true : h.dia === diaActivo))
      .sort((a, b) => {
        if (diaActivo === 'Todos' && a.dia !== b.dia) {
          return DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia);
        }
        return a.hora.localeCompare(b.hora);
      });
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
          dia: diaModal,
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
          onPress={() => {
            setDiaModal(diaActivo === 'Todos' ? 'Lunes' : diaActivo);
            setModalAgregar(true);
          }}
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
            <Text style={s.webHeaderSub}>
              {horariosParseados.length} {horariosParseados.length === 1 ? 'bloque asignado' : 'bloques asignados'} en la semana
            </Text>
          </View>
        </View>

        {/* ── SELECTOR DE DÍAS (Estilo web pill neumorphic) ── */}
        <View style={s.diasBarCard}>
          <View style={s.diasPillsRow}>
            {/* Pill TODOS */}
            <TouchableOpacity
              style={[s.diaPill, diaActivo === 'Todos' && s.diaPillActive]}
              onPress={() => setDiaActivo('Todos')}
              activeOpacity={0.8}
            >
              <Text style={[s.diaPillAbrev, diaActivo === 'Todos' && s.diaPillAbrevActive]}>TODOS</Text>
              <View style={[s.diaPillCount, diaActivo === 'Todos' && s.diaPillCountActive]}>
                <Text style={[s.diaPillCountText, diaActivo === 'Todos' && s.diaPillCountTextActive]}>
                  {horariosParseados.length}
                </Text>
              </View>
            </TouchableOpacity>

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
              <Ionicons name="time" size={18} color={COLORS.accent} />
              <Text style={s.sectionTitle}>
                {diaActivo === 'Todos' ? 'TODAS LAS CLASES' : `CLASES DEL ${DIAS_LABEL[diaActivo].toUpperCase()}`} ({clasesDelDia.length})
              </Text>
            </View>
          </View>

          {clasesDelDia.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="cafe-outline" size={48} color={COLORS.secondary} />
              <Text style={s.emptyTitle}>
                {diaActivo === 'Todos'
                  ? 'No hay horarios de clase cargados'
                  : `No hay clases para el ${DIAS_LABEL[diaActivo]}`}
              </Text>
              <Text style={s.emptySub}>
                Tocá en "+ Bloque" para agregar una clase a este día.
              </Text>
              {horariosParseados.length > 0 && diaActivo !== 'Todos' && (
                <TouchableOpacity
                  style={s.verTodosHorariosBtn}
                  onPress={() => setDiaActivo('Todos')}
                  activeOpacity={0.8}
                >
                  <Text style={s.verTodosHorariosText}>
                    Ver todas las clases de la semana ({horariosParseados.length}) →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            clasesDelDia.map((c) => (
              <View key={c.id} style={s.claseCard}>
                <View style={s.claseCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={s.horaBox}>
                      <Ionicons name="time-outline" size={15} color={COLORS.accent} />
                      <Text style={s.horaText}>{c.hora}</Text>
                    </View>

                    {diaActivo === 'Todos' && (
                      <View style={s.diaTagBadge}>
                        <Text style={s.diaTagText}>{DIAS_ABREV[c.dia]}</Text>
                      </View>
                    )}
                  </View>

                  {c.curso ? (
                    <View style={s.cursoBadge}>
                      <Text style={s.cursoBadgeText}>{formatAnio(c.curso)}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={s.deleteClaseBtn}
                    onPress={() => handleEliminarHorario(c.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <Text style={s.materiaText} numberOfLines={1}>{c.materia}</Text>

                {c.escuela ? (
                  <View style={s.escuelaRow}>
                    <Ionicons name="business-outline" size={14} color={COLORS.secondary} />
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
                    <Ionicons name="arrow-forward" size={13} color={COLORS.accent} />
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
              <Text style={m.title}>+ Nueva Clase</Text>
              <TouchableOpacity onPress={() => setModalAgregar(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {/* Selector de Día en el Modal */}
            <View style={{ marginBottom: 4 }}>
              <Text style={s.labelChips}>Día de la semana:</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DIAS.map((d) => {
                  const isSel = diaModal === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[s.diaModalChip, isSel && s.diaModalChipActive]}
                      onPress={() => setDiaModal(d)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.diaModalChipText, isSel && s.diaModalChipTextActive]}>
                        {DIAS_ABREV[d]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42 }}>
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
                      <Text style={s.chipCursoText}>{cu.materia} ({formatAnio(cu.anio)})</Text>
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
  loadingText: { fontSize: 17, color: COLORS.secondary, fontWeight: '600' },

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
  topNavTitle: { fontSize: 19, fontWeight: '800', color: COLORS.onSurface, textTransform: 'uppercase' },
  nuevoHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  nuevoHeaderText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  webHeaderRow: { marginBottom: SPACING.xs },
  webHeaderTitle: { fontSize: 26, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.3, textTransform: 'uppercase' },
  webHeaderSub: { fontSize: 15, color: COLORS.secondary, fontWeight: '500', marginTop: 2 },

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
  diasPillsRow: { flexDirection: 'row', gap: 3 },
  diaPill: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 3,
  },
  diaPillActive: { backgroundColor: COLORS.accent },
  diaPillAbrev: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  diaPillAbrevActive: { color: '#fff' },
  diaPillCount: {
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  diaPillCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  diaPillCountText: { fontSize: 11, fontWeight: '800', color: COLORS.accent },
  diaPillCountTextActive: { color: '#fff' },

  // Sección Clases
  clasesSection: { gap: SPACING.sm },
  sectionHeader: { marginBottom: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.secondary, letterSpacing: 0.5 },

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
    gap: 5,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  horaText: { fontSize: 13.5, fontWeight: '800', color: COLORS.accent },
  cursoBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursoBadgeText: { fontSize: 16, fontWeight: '900', color: COLORS.accent, letterSpacing: 0.3 },
  deleteClaseBtn: { padding: 4 },
  materiaText: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, textTransform: 'uppercase' },
  escuelaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  escuelaText: { fontSize: 13.5, color: COLORS.secondary, fontWeight: '500', flex: 1 },
  irAlAulaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginTop: 2,
  },
  irAlAulaText: { fontSize: 12, fontWeight: '800', color: COLORS.accent, textTransform: 'uppercase' },

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
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 13.5, color: COLORS.secondary, textAlign: 'center' },

  horaInputsRow: { flexDirection: 'row', gap: SPACING.sm },
  labelChips: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 4 },
  chipCurso: {
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  chipCursoText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },

  // Tags y botones adicionales
  diaTagBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  diaTagText: { fontSize: 11, fontWeight: '800', color: COLORS.accent },

  verTodosHorariosBtn: {
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  verTodosHorariosText: { fontSize: 12, fontWeight: '800', color: COLORS.accent },

  diaModalChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaModalChipActive: { backgroundColor: COLORS.accent },
  diaModalChipText: { fontSize: 12, fontWeight: '800', color: COLORS.secondary },
  diaModalChipTextActive: { color: '#ffffff' },
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
  title: { fontSize: 19, fontWeight: '800', color: COLORS.onSurface },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
