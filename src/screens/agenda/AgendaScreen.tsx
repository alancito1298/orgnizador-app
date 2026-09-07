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

interface AgendaItem {
  id: number;
  fecha: string;
  descripcion: string;
}

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const toKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function AgendaScreen() {
  const navigation = useNavigation<Nav>();

  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());

  // Modal Agregar
  const [modalAgregar, setModalAgregar] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal Ver eventos del día
  const [modalVer, setModalVer] = useState(false);
  const [eventosDelDia, setEventosDelDia] = useState<AgendaItem[]>([]);

  const fetchAgenda = useCallback(async () => {
    try {
      const data = await apiFetch<AgendaItem[]>('/agenda', { auth: true });
      if (Array.isArray(data)) {
        setAgendaItems(data);
      }
    } catch (e) {
      console.error('Error al cargar agenda:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAgenda();
  };

  const diasConEventos = useMemo(() => {
    const set = new Set<string>();
    agendaItems.forEach((i) => {
      if (i.fecha) set.add(i.fecha.split('T')[0]);
    });
    return set;
  }, [agendaItems]);

  // Construir celdas del mes
  const celdas = useMemo(() => {
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    let offset = primerDia.getDay() - 1;
    if (offset < 0) offset = 6;

    const lista: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
    ];
    while (lista.length % 7 !== 0) lista.push(null);
    return lista;
  }, [year, month]);

  const navMes = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setMonth(m);
    setYear(y);
  };

  const irAHoy = () => {
    const h = new Date();
    setMonth(h.getMonth());
    setYear(h.getFullYear());
  };

  const handleClickDia = (dia: number) => {
    const key = toKey(year, month, dia);
    const notas = agendaItems.filter((i) => i.fecha.split('T')[0] === key);
    setDiaSeleccionado(key);

    if (notas.length > 0) {
      setEventosDelDia(notas);
      setModalVer(true);
    } else {
      setDescripcion('');
      setModalAgregar(true);
    }
  };

  const handleGuardarEvento = async () => {
    if (!descripcion.trim() || !diaSeleccionado) {
      Alert.alert('Datos requeridos', 'Por favor ingresá una descripción para el evento.');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/agenda', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          fecha: diaSeleccionado,
          descripcion: descripcion.trim(),
        }),
      });

      setDescripcion('');
      setModalAgregar(false);
      fetchAgenda();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo agendar el evento.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarEvento = (id: number) => {
    Alert.alert('¿Eliminar evento?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/agenda/${id}`, { method: 'DELETE', auth: true });
            setEventosDelDia((prev) => prev.filter((i) => i.id !== id));
            fetchAgenda();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar el evento.');
          }
        },
      },
    ]);
  };

  const eventosDelMes = useMemo(() => {
    return agendaItems
      .filter((a) => {
        const [y, m] = a.fecha.split('T')[0].split('-').map(Number);
        return y === year && m === month + 1;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [agendaItems, year, month]);

  const hoyKeyStr = toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Cargando agenda docente...</Text>
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
        <Text style={s.topNavTitle}>AGENDA DOCENTE</Text>
        <TouchableOpacity
          style={s.agendarHeaderBtn}
          onPress={() => {
            setDiaSeleccionado(hoyKeyStr);
            setDescripcion('');
            setModalAgregar(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.agendarHeaderText}>Agendar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* ── ENCABEZADO AGENDA (Fiel al web Agenda.tsx) ── */}
        <View style={s.webHeaderRow}>
          <Text style={s.webHeaderTitle}>AGENDA DOCENTE</Text>
          <Text style={s.webHeaderSub}>Organizá tus fechas, eventos y actividades escolares.</Text>
        </View>

        {/* ── CARD DEL CALENDARIO (Fiel al web: neumorphic raised 3xl) ── */}
        <View style={s.calendarCard}>
          {/* Navegación del mes */}
          <View style={s.monthNavRow}>
            <View style={s.monthTitleRow}>
              <Text style={s.monthName}>{MESES[month]}</Text>
              <Text style={s.yearNum}>{year}</Text>
            </View>

            <View style={s.monthNavButtons}>
              <TouchableOpacity style={s.todayBtn} onPress={irAHoy} activeOpacity={0.75}>
                <Text style={s.todayBtnText}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.navArrowBtn} onPress={() => navMes(-1)} activeOpacity={0.75}>
                <Ionicons name="chevron-back" size={18} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={s.navArrowBtn} onPress={() => navMes(1)} activeOpacity={0.75}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Días de la semana */}
          <View style={s.daysOfWeekRow}>
            {DIAS.map((d, i) => (
              <View key={d} style={s.dayOfWeekCell}>
                <Text style={[s.dayOfWeekText, i >= 5 && { color: '#dc2626' }]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grilla de días */}
          <View style={s.gridWrap}>
            {celdas.map((dia, idx) => {
              if (dia === null) {
                return <View key={`empty-${idx}`} style={s.gridCellEmpty} />;
              }

              const diaKey = toKey(year, month, dia);
              const esHoy = diaKey === hoyKeyStr;
              const tieneEventos = diasConEventos.has(diaKey);

              return (
                <TouchableOpacity
                  key={diaKey}
                  style={[s.gridCell, esHoy && s.gridCellToday]}
                  onPress={() => handleClickDia(dia)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.cellDayText, esHoy && s.cellDayTextToday]}>{dia}</Text>
                  {tieneEventos && <View style={[s.eventDot, esHoy && { backgroundColor: '#fff' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── LISTADO DE EVENTOS DEL MES ── */}
        <View style={s.eventsSection}>
          <View style={s.eventsSectionHeader}>
            <View style={s.eventsTitleRow}>
              <Ionicons name="calendar" size={16} color={COLORS.accent} />
              <Text style={s.eventsSectionTitle}>
                {eventosDelMes.length} {eventosDelMes.length === 1 ? 'EVENTO' : 'EVENTOS'} EN {MESES[month].toUpperCase()}
              </Text>
            </View>
          </View>

          {eventosDelMes.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={36} color={COLORS.secondary} />
              <Text style={s.emptyTitle}>No hay eventos agendados para este mes</Text>
              <Text style={s.emptySub}>Tocá cualquier día del calendario o el botón "+ Agendar" para crear uno.</Text>
            </View>
          ) : (
            eventosDelMes.map((ev) => {
              const partes = ev.fecha.split('T')[0].split('-');
              const diaNum = Number(partes[2]);
              const mesNum = Number(partes[1]) - 1;

              return (
                <View key={ev.id} style={s.eventCard}>
                  <View style={s.eventDiaBox}>
                    <Text style={s.eventDiaLabel}>DÍA</Text>
                    <Text style={s.eventDiaNum}>{diaNum}</Text>
                  </View>

                  <View style={s.eventInfo}>
                    <Text style={s.eventDesc}>{ev.descripcion}</Text>
                    <Text style={s.eventFecha}>{diaNum} de {MESES[mesNum]} de {partes[0]}</Text>
                  </View>

                  <TouchableOpacity
                    style={s.deleteEventBtn}
                    onPress={() => handleEliminarEvento(ev.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={17} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── MODAL AGREGAR EVENTO ── */}
      <Modal visible={modalAgregar} transparent animationType="slide" onRequestClose={() => setModalAgregar(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>+ Agendar para el {diaSeleccionado}</Text>
              <TouchableOpacity onPress={() => setModalAgregar(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <AppInput
              label="Descripción del evento *"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Ej: Entrega de TP N°2, Examen final, etc."
              multiline
              numberOfLines={3}
            />

            <View style={m.actions}>
              <AppButton label="Cancelar" variant="outline" onPress={() => setModalAgregar(false)} style={{ flex: 1 }} />
              <AppButton label={guardando ? 'Guardando...' : 'Agendar'} onPress={handleGuardarEvento} loading={guardando} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL VER EVENTOS DEL DÍA ── */}
      <Modal visible={modalVer} transparent animationType="slide" onRequestClose={() => setModalVer(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>Eventos del {diaSeleccionado}</Text>
              <TouchableOpacity onPress={() => setModalVer(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {eventosDelDia.map((ev) => (
                <View key={ev.id} style={s.modalEventItem}>
                  <Text style={s.modalEventText}>{ev.descripcion}</Text>
                  <TouchableOpacity onPress={() => handleEliminarEvento(ev.id)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={m.actions}>
              <AppButton
                label="+ Agregar Otro Evento"
                variant="outline"
                onPress={() => {
                  setModalVer(false);
                  setDescripcion('');
                  setModalAgregar(true);
                }}
                style={{ flex: 1 }}
              />
              <AppButton label="Cerrar" onPress={() => setModalVer(false)} style={{ flex: 1 }} />
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

  // Top Nav
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
  agendarHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  agendarHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Scroll
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.lg },
  webHeaderRow: { marginBottom: -4 },
  webHeaderTitle: { fontSize: 22, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.3, textTransform: 'uppercase' },
  webHeaderSub: { fontSize: 12, color: COLORS.secondary, fontWeight: '500', marginTop: 2 },

  // Calendario Card Neumorphic
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    gap: SPACING.md,
  },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  monthName: { fontSize: 22, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.5 },
  yearNum: { fontSize: 16, fontWeight: '600', color: COLORS.secondary },
  monthNavButtons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  todayBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.accent },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },

  daysOfWeekRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 6 },
  dayOfWeekCell: { flex: 1, alignItems: 'center' },
  dayOfWeekText: { fontSize: 11, fontWeight: '800', color: COLORS.secondary, textTransform: 'uppercase' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    marginVertical: 2,
  },
  gridCellEmpty: { width: '14.28%', aspectRatio: 1 },
  gridCellToday: { backgroundColor: COLORS.accent },
  cellDayText: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  cellDayTextToday: { color: '#fff', fontWeight: '800' },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.accent,
    position: 'absolute',
    bottom: 4,
  },

  // Eventos del mes
  eventsSection: { gap: SPACING.sm },
  eventsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  eventsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventsSectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.secondary, letterSpacing: 0.5 },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  eventDiaBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDiaLabel: { fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  eventDiaNum: { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 20 },
  eventInfo: { flex: 1, gap: 2 },
  eventDesc: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  eventFecha: { fontSize: 11, color: COLORS.secondary, fontWeight: '500' },
  deleteEventBtn: { padding: 8 },

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
  emptyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, textAlign: 'center' },
  emptySub: { fontSize: 11, color: COLORS.secondary, textAlign: 'center', maxWidth: 260 },

  modalEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
  },
  modalEventText: { fontSize: 13, fontWeight: '600', color: COLORS.onSurface, flex: 1, marginRight: 8 },
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
