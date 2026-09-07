import React, { useEffect, useState, useCallback } from 'react';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AlertMessage from '../../components/ui/AlertMessage';
import BottomNav from '../../components/shared/BottomNav';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

// ─── Tipos ────────────────────────────────────────────────────────────────
interface Curso { id: number; escuela: string; anio: string; materia: string; ruta: string; }
interface HorarioExtra { dia: string; hora: string; }

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

function formatAnio(anio: string): string {
  const n = parseInt(anio, 10);
  const nombres: Record<number, string> = { 1:'1er Año',2:'2do Año',3:'3er Año',4:'4to Año',5:'5to Año',6:'6to Año',7:'7mo Año' };
  return isNaN(n) ? anio : (nombres[n] || `${n}° Año`);
}

function iconoPorMateria(m: string): keyof typeof Ionicons.glyphMap {
  const s = m.toLowerCase();
  if (s.includes('mat') || s.includes('álgebra')) return 'calculator-outline';
  if (s.includes('hist') || s.includes('geo')) return 'earth-outline';
  if (s.includes('leng') || s.includes('lit')) return 'book-outline';
  if (s.includes('fís') || s.includes('quím') || s.includes('bio')) return 'flask-outline';
  if (s.includes('tecno') || s.includes('inform')) return 'laptop-outline';
  if (s.includes('inglés') || s.includes('idioma')) return 'language-outline';
  if (s.includes('música') || s.includes('arte')) return 'musical-notes-outline';
  return 'school-outline';
}

// ─── Card de Curso (fiel al web: anio box violeta + materia + escuela) ────
function CursoCard({ curso, onEliminar }: { curso: Curso; onEliminar: (id: number) => void }) {
  const navigation = useNavigation<Nav>();
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      // 1. Borrar horarios asociados
      const horarios = await apiFetch<any[]>('/horarios', { auth: true }).catch(() => []);
      if (Array.isArray(horarios)) {
        const matNorm = curso.materia.trim().toLowerCase();
        const aEliminar = horarios.filter(h => {
          if (!h.descripcion) return false;
          try {
            const p = JSON.parse(h.descripcion);
            if (p.cursoId && Number(p.cursoId) === Number(curso.id)) return true;
            return (p.materia || '').trim().toLowerCase() === matNorm;
          } catch {
            return h.descripcion.toLowerCase().includes(matNorm);
          }
        });
        await Promise.allSettled(aEliminar.map(h => apiFetch(`/horarios/${h.id}`, { method: 'DELETE', auth: true })));
      }
      // 2. Borrar curso
      await apiFetch(`/cursos/${curso.id}`, { method: 'DELETE', auth: true });
      onEliminar(curso.id);
    } catch {
      Alert.alert('Error', '❌ No se pudo eliminar el curso');
    } finally {
      setEliminando(false);
      setConfirmando(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={card.wrap}
        onPress={() => navigation.navigate('CursoDetalle', { cursoId: curso.id, curso })}
        activeOpacity={0.85}
      >
        {/* Ícono año (caja violeta) */}
        <View style={card.anioBox}>
          <Text style={card.anioNum}>{curso.anio}°</Text>
          <Text style={card.anioLabel}>Año</Text>
        </View>

        {/* Info */}
        <View style={card.info}>
          <View style={card.topRow}>
            <View style={card.anioBadge}>
              <Text style={card.anioBadgeText}>{formatAnio(curso.anio)}</Text>
            </View>
            <Text style={card.escuela} numberOfLines={1}>{curso.escuela}</Text>
          </View>
          <Text style={card.materia} numberOfLines={1}>{curso.materia}</Text>
          <View style={card.ingresarRow}>
            <Ionicons name="arrow-forward" size={12} color={COLORS.accent} />
            <Text style={card.ingresarText}>Ingresar al aula</Text>
          </View>
        </View>

        {/* Botón eliminar */}
        <TouchableOpacity
          style={card.deleteBtn}
          onPress={(e) => {
            e.stopPropagation();
            setConfirmando(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={17} color="#9ca3af" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Modal confirmación eliminación */}
      <Modal visible={confirmando} transparent animationType="fade" onRequestClose={() => setConfirmando(false)}>
        <View style={del.overlay}>
          <View style={del.sheet}>
            <Text style={del.emoji}>🗑️</Text>
            <Text style={del.title}>¿Eliminar curso?</Text>
            <Text style={del.subtitle}>{curso.anio}° — {curso.materia}</Text>
            <Text style={del.subtitleSub}>{curso.escuela}</Text>
            <Text style={del.warning}>
              Se eliminarán todos los alumnos, asistencias y calificaciones asociadas.
            </Text>
            <View style={del.btnRow}>
              <TouchableOpacity style={del.cancelBtn} onPress={() => setConfirmando(false)}>
                <Text style={del.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={del.confirmBtn} onPress={handleEliminar} disabled={eliminando}>
                <Text style={del.confirmText}>{eliminando ? 'Eliminando...' : 'Sí, eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const card = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
    padding: SPACING.md, marginBottom: SPACING.sm,
    shadowColor: '#7c3aed', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:3,
    gap: SPACING.md,
  },
  anioBox: {
    width: 60, height: 60, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg, alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  anioNum: { color:'#fff', fontSize:22, fontWeight:'800', lineHeight:24 },
  anioLabel: { color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  info: { flex:1, gap:3 },
  topRow: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  anioBadge: { backgroundColor:'#ede9fe', borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  anioBadgeText: { fontSize:10, fontWeight:'800', color:'#5b21b6', textTransform:'uppercase' },
  escuela: { fontSize:11, color:'#7c3aed', fontWeight:'700', textTransform:'uppercase', letterSpacing:0.3, flex:1 },
  materia: { fontSize:16, fontWeight:'800', color:'#111827', textTransform:'uppercase', letterSpacing:0.2 },
  ingresarRow: { flexDirection:'row', alignItems:'center', gap:3, marginTop:2 },
  ingresarText: { fontSize:12, color: COLORS.accent, fontWeight:'600' },
  deleteBtn: { padding:8, borderRadius: RADIUS.md },
});

const del = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding: SPACING.xl },
  sheet: { backgroundColor:'#fff', borderRadius: RADIUS.xxl, padding: SPACING.xl, alignItems:'center', gap: SPACING.sm },
  emoji: { fontSize:40 },
  title: { fontSize:18, fontWeight:'800', color:'#4c1d95' },
  subtitle: { fontSize:14, fontWeight:'700', color:'#374151' },
  subtitleSub: { fontSize:13, color:'#6b7280' },
  warning: { fontSize:12, color:'#ef4444', textAlign:'center', lineHeight:18, marginTop:4 },
  btnRow: { flexDirection:'row', gap: SPACING.sm, marginTop: SPACING.sm, width:'100%' },
  cancelBtn: {
    flex:1, paddingVertical:11, borderRadius: RADIUS.lg,
    backgroundColor:'#f3f4f6', alignItems:'center',
  },
  cancelText: { fontSize:13, fontWeight:'700', color:'#374151' },
  confirmBtn: {
    flex:1, paddingVertical:11, borderRadius: RADIUS.lg,
    backgroundColor:'#ef4444', alignItems:'center',
  },
  confirmText: { fontSize:13, fontWeight:'700', color:'#fff' },
});

// ─── Modal Crear Curso ────────────────────────────────────────────────────
function ModalCrearCurso({ visible, onClose, onCreado }: {
  visible: boolean;
  onClose: () => void;
  onCreado: (curso: Curso) => void;
}) {
  const [anio, setAnio] = useState('');
  const [escuela, setEscuela] = useState('');
  const [materia, setMateria] = useState('');
  const [asignarHorario, setAsignarHorario] = useState(true);
  const [diaPrincipal, setDiaPrincipal] = useState('Lunes');
  const [horaPrincipal, setHoraPrincipal] = useState('08:00 a 09:20');
  const [horariosExtra, setHorariosExtra] = useState<HorarioExtra[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiaSelector, setShowDiaSelector] = useState(false);
  const [extraDiaIndex, setExtraDiaIndex] = useState<number | null>(null);

  const reset = () => {
    setAnio(''); setEscuela(''); setMateria('');
    setAsignarHorario(true); setDiaPrincipal('Lunes');
    setHoraPrincipal('08:00 a 09:20'); setHorariosExtra([]);
    setError(null); setGuardando(false);
  };

  const guardar = async () => {
    if (!anio.trim() || !escuela.trim() || !materia.trim()) {
      setError('Completá año, institución y materia.');
      return;
    }
    setGuardando(true); setError(null);
    try {
      const data = await apiFetch<Curso>('/cursos', {
        method: 'POST', auth: true,
        body: JSON.stringify({ escuela: escuela.trim(), anio: anio.trim(), materia: materia.trim() }),
      });

      if (asignarHorario && data.id) {
        const lista: HorarioExtra[] = [];
        if (horaPrincipal.trim()) lista.push({ dia: diaPrincipal, hora: horaPrincipal.trim() });
        horariosExtra.forEach(h => { if (h.hora.trim()) lista.push(h); });

        if (lista.length > 0) {
          const desc = JSON.stringify({ materia: materia.trim(), curso: anio.trim(), escuela: escuela.trim(), cursoId: data.id });
          await Promise.allSettled(lista.map(h =>
            apiFetch('/horarios', { method:'POST', auth:true, body: JSON.stringify({ dia: h.dia, hora: h.hora, descripcion: desc }) })
          ));
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
      <View style={mc.overlay}>
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
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={mc.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={mc.scroll}>
            {error && <AlertMessage type="error" message={error} />}

            <View style={mc.fields}>
              <AppInput label="Año o División *" iconName="layers-outline"
                placeholder="Ej. 1° Año, 2° 1ra" value={anio} onChangeText={setAnio} />
              <AppInput label="Institución / Escuela *" iconName="business-outline"
                placeholder="Ej. E.E.S. N° 5, Normal 1" value={escuela} onChangeText={setEscuela} autoCapitalize="words" />
              <AppInput label="Materia *" iconName="book-outline"
                placeholder="Ej. Matemática, Historia" value={materia} onChangeText={setMateria} autoCapitalize="words" />
            </View>

            {/* Sección Horarios */}
            <View style={mc.horarioSection}>
              <View style={mc.horarioHeader}>
                <View>
                  <View style={mc.horarioTitleRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.accent} />
                    <Text style={mc.horarioTitle}>HORARIOS EN LA GRILLA SEMANAL</Text>
                  </View>
                  <Text style={mc.horarioSub}>Se vincularán automáticamente al horario.</Text>
                </View>
                <View style={mc.switchRow}>
                  <Text style={mc.switchLabel}>Activo</Text>
                  <Switch value={asignarHorario} onValueChange={setAsignarHorario}
                    trackColor={{ false: '#e5e7eb', true: COLORS.accentLight }}
                    thumbColor={asignarHorario ? COLORS.accent : '#d1d5db'} />
                </View>
              </View>

              {asignarHorario && (
                <View style={mc.horarioBox}>
                  {/* Día principal */}
                  <View style={mc.diaRow}>
                    <View style={mc.diaCol}>
                      <Text style={mc.diaLabel}>DÍA:</Text>
                      <TouchableOpacity style={mc.diaSelector} onPress={() => { setExtraDiaIndex(null); setShowDiaSelector(true); }}>
                        <Text style={mc.diaSelectorText}>{diaPrincipal}</Text>
                        <Ionicons name="chevron-down" size={14} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>
                    <View style={mc.diaCol}>
                      <Text style={mc.diaLabel}>FRANJA HORARIA:</Text>
                      <AppInput label="" iconName="time-outline" placeholder="Ej. 08:00 a 09:20"
                        value={horaPrincipal} onChangeText={setHoraPrincipal} style={mc.horaInput} />
                    </View>
                  </View>

                  {/* Días extra */}
                  {horariosExtra.map((extra, idx) => (
                    <View key={idx} style={[mc.diaRow, mc.diaRowExtra]}>
                      <View style={mc.diaCol}>
                        <Text style={mc.diaLabel}>DÍA ADICIONAL:</Text>
                        <TouchableOpacity style={mc.diaSelector}
                          onPress={() => { setExtraDiaIndex(idx); setShowDiaSelector(true); }}>
                          <Text style={mc.diaSelectorText}>{extra.dia}</Text>
                          <Ionicons name="chevron-down" size={14} color={COLORS.accent} />
                        </TouchableOpacity>
                      </View>
                      <View style={mc.diaCol}>
                        <Text style={mc.diaLabel}>FRANJA HORARIA:</Text>
                        <AppInput label="" iconName="time-outline" placeholder="Ej. 10:00 a 11:20"
                          value={extra.hora}
                          onChangeText={v => setHorariosExtra(prev => prev.map((h, i) => i === idx ? { ...h, hora: v } : h))}
                          style={mc.horaInput} />
                      </View>
                      <TouchableOpacity style={mc.removeBtn}
                        onPress={() => setHorariosExtra(prev => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity style={mc.addDiaBtn}
                    onPress={() => setHorariosExtra(prev => [...prev, { dia: 'Miercoles', hora: horaPrincipal }])}>
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.accent} />
                    <Text style={mc.addDiaText}>+ Agregar otro día de cursada</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Acciones */}
          <View style={mc.actions}>
            <AppButton label="Cancelar" variant="outline" onPress={() => { reset(); onClose(); }} style={{ flex: 1 }} />
            <AppButton label="Guardar Curso" loading={guardando} onPress={guardar} style={{ flex: 1 }} />
          </View>
        </View>
      </View>

      {/* Selector de día (dropdown) */}
      <Modal visible={showDiaSelector} transparent animationType="fade" onRequestClose={() => setShowDiaSelector(false)}>
        <TouchableOpacity style={ds.overlay} onPress={() => setShowDiaSelector(false)} activeOpacity={1}>
          <View style={ds.sheet}>
            <Text style={ds.title}>Seleccioná el día</Text>
            {DIAS_SEMANA.map(d => (
              <TouchableOpacity key={d} style={ds.option}
                onPress={() => {
                  if (extraDiaIndex === null) setDiaPrincipal(d);
                  else setHorariosExtra(prev => prev.map((h, i) => i === extraDiaIndex ? { ...h, dia: d } : h));
                  setShowDiaSelector(false);
                }}>
                <Text style={[ds.optionText,
                  (extraDiaIndex === null ? diaPrincipal : horariosExtra[extraDiaIndex!]?.dia) === d && ds.optionSelected
                ]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const mc = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet: {
    backgroundColor:'#f5f3ff', borderTopLeftRadius:28, borderTopRightRadius:28,
    padding: SPACING.xl, maxHeight:'92%',
    shadowColor:'#000', shadowOffset:{width:0,height:-4}, shadowOpacity:0.15, shadowRadius:20, elevation:20,
  },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.lg },
  headerLeft: { flexDirection:'row', alignItems:'center', gap: SPACING.sm },
  iconBox: {
    width:40, height:40, borderRadius: RADIUS.lg,
    backgroundColor:'rgba(124,58,237,0.1)', alignItems:'center', justifyContent:'center',
  },
  title: { fontSize:16, fontWeight:'800', color: COLORS.accent, letterSpacing:0.5 },
  subtitle: { fontSize:11, color: COLORS.secondary, fontWeight:'500', marginTop:2 },
  closeBtn: {
    width:36, height:36, borderRadius: RADIUS.lg, backgroundColor:'#ebe9f8',
    alignItems:'center', justifyContent:'center',
  },
  scroll: { maxHeight: 440 },
  fields: { gap: SPACING.md, marginBottom: SPACING.lg },
  horarioSection: { marginBottom: SPACING.lg },
  horarioHeader: { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom: SPACING.sm },
  horarioTitleRow: { flexDirection:'row', alignItems:'center', gap:5, marginBottom:3 },
  horarioTitle: { fontSize:11, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
  horarioSub: { fontSize:11, color: COLORS.secondary },
  switchRow: { alignItems:'center', gap:4 },
  switchLabel: { fontSize:11, fontWeight:'700', color: COLORS.accent },
  horarioBox: {
    backgroundColor:'rgba(124,58,237,0.06)', borderRadius: RADIUS.xl,
    padding: SPACING.md, gap: SPACING.sm,
  },
  diaRow: { flexDirection:'row', gap: SPACING.sm, alignItems:'flex-start' },
  diaRowExtra: { borderTopWidth:1, borderTopColor:'rgba(124,58,237,0.15)', paddingTop: SPACING.sm, position:'relative' },
  diaCol: { flex:1, gap:4 },
  diaLabel: { fontSize:10, fontWeight:'700', color: COLORS.secondary, textTransform:'uppercase', letterSpacing:0.5 },
  diaSelector: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical:10,
    shadowColor:'#A3B1C6', shadowOffset:{width:2,height:2}, shadowOpacity:0.4, shadowRadius:4, elevation:2,
  },
  diaSelectorText: { fontSize:13, fontWeight:'700', color: COLORS.onSurface },
  horaInput: { marginBottom:0 },
  removeBtn: { position:'absolute', right:-4, top:8 },
  addDiaBtn: { flexDirection:'row', alignItems:'center', gap:5, marginTop:4 },
  addDiaText: { fontSize:12, fontWeight:'800', color: COLORS.accent },
  actions: { flexDirection:'row', gap: SPACING.sm, marginTop: SPACING.md },
});

const ds = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding: SPACING.xl },
  sheet: { backgroundColor:'#fff', borderRadius: RADIUS.xxl, padding: SPACING.xl },
  title: { fontSize:15, fontWeight:'800', color: COLORS.onSurface, marginBottom: SPACING.md },
  option: { paddingVertical:12, borderBottomWidth:1, borderBottomColor:'rgba(124,58,237,0.1)' },
  optionText: { fontSize:14, fontWeight:'600', color: COLORS.onSurface },
  optionSelected: { color: COLORS.accent, fontWeight:'800' },
});

// ══ CURSOS SCREEN ══════════════════════════════════════════════════════════
export default function CursosScreen() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);

  const fetchCursos = useCallback(async () => {
    try {
      const data = await apiFetch<Curso[]>('/cursos', { auth: true });
      setCursos(Array.isArray(data) ? data : []);
    } catch { setCursos([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchCursos(); }, [fetchCursos]);
  const onRefresh = () => { setRefreshing(true); fetchCursos(); };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        >
          {/* Header (Fiel al web Cursos.tsx) */}
          <View style={s.header}>
            <View style={{ flex: 1, paddingRight: SPACING.sm }}>
              <Text style={s.title}>PANEL DE CURSOS Y AULAS ESCOLARES</Text>
              <Text style={s.subtitle}>
                Administrá la asistencia, calificaciones y alumnos de tus materias.
              </Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => setModalCrear(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.addBtnText}>Nuevo</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : cursos.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="school-outline" size={56} color={COLORS.secondary} />
              <Text style={s.emptyTitle}>Aún no tenés cursos</Text>
              <Text style={s.emptyText}>Creá tu primer curso y empezá a organizar tus clases.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setModalCrear(true)}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                <Text style={s.emptyBtnText}>Crear Curso</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.lista}>
              {cursos.map(c => (
                <CursoCard
                  key={c.id}
                  curso={c}
                  onEliminar={id => setCursos(prev => prev.filter(x => x.id !== id))}
                />
              ))}

              {/* Botón Agregar al final (fiel al web) */}
              <TouchableOpacity
                style={s.btnAgregarBottom}
                onPress={() => setModalCrear(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color={COLORS.accent} />
                <Text style={s.btnAgregarBottomText}>AGREGAR NUEVO CURSO</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      <ModalCrearCurso
        visible={modalCrear}
        onClose={() => setModalCrear(false)}
        onCreado={c => setCursos(prev => [c, ...prev])}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor: COLORS.background },
  scroll: { flex:1 },
  content: { padding: SPACING.xl, paddingTop: SPACING.lg },
  centered: { paddingVertical: 60, alignItems:'center' },
  header: { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom: SPACING.xl },
  title: { fontSize:19, fontWeight:'800', color: COLORS.accent, letterSpacing:-0.3, textTransform:'uppercase' },
  subtitle: { fontSize:12, color: COLORS.secondary, fontWeight:'500', marginTop:4, lineHeight:17 },
  addBtn: {
    flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg, paddingVertical:10,
    shadowColor: COLORS.accent, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:5,
  },
  addBtnText: { fontSize:13, fontWeight:'800', color:'#fff', textTransform:'uppercase', letterSpacing:0.5 },
  lista: { gap: 2 },
  emptyBox: {
    alignItems:'center', gap: SPACING.sm, paddingVertical:60,
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.xxl, padding: SPACING.xl,
  },
  emptyTitle: { fontSize:18, fontWeight:'800', color: COLORS.onSurface },
  emptyText: { fontSize:13, color: COLORS.secondary, textAlign:'center', lineHeight:20, maxWidth:260 },
  emptyBtn: {
    flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor:'#fff', borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical:10, marginTop: SPACING.sm,
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:3,
  },
  emptyBtnText: { fontSize:13, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
  btnAgregarBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  btnAgregarBottomText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
