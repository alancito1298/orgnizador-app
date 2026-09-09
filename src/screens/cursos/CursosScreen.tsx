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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AlertMessage from '../../components/ui/AlertMessage';
import BottomNav from '../../components/shared/BottomNav';
import { COLORS, RADIUS, SPACING } from '../../theme';
import ModalCrearCurso from '../../components/cursos/ModalCrearCurso';
import ModalEditarHorariosCurso from '../../components/cursos/ModalEditarHorariosCurso';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

// ─── Tipos ────────────────────────────────────────────────────────────────
interface Curso { id: number; escuela: string; anio: string; materia: string; ruta: string; }
interface HorarioExtra { dia: string; hora: string; }

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

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
function CursoCard({
  curso,
  onEliminar,
  onEditarHorarios,
}: {
  curso: Curso;
  onEliminar: (id: number) => void;
  onEditarHorarios: (curso: Curso) => void;
}) {
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
          <Text style={card.anioNum}>{formatAnio(curso.anio)}</Text>
          <Text style={card.anioLabel}>Curso</Text>
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

        {/* Acciones: Editar horarios y eliminar */}
        <View style={card.actionsCol}>
          <TouchableOpacity
            style={card.editBtn}
            onPress={() => onEditarHorarios(curso)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={card.deleteBtn}
            onPress={() => setConfirmando(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {eliminando ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#9ca3af" />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Modal confirmación de borrado */}
      <Modal visible={confirmando} transparent animationType="fade" onRequestClose={() => setConfirmando(false)}>
        <View style={del.overlay}>
          <View style={del.sheet}>
            <Text style={del.emoji}>⚠️</Text>
            <Text style={del.title}>¿Eliminar curso?</Text>
            <Text style={del.subtitle}>{curso.materia}</Text>
            <Text style={del.subtitleSub}>{curso.escuela} · {formatAnio(curso.anio)}</Text>
            <Text style={del.warning}>
              Se eliminarán también todos los horarios asociados a este curso en la grilla. Esta acción no se puede deshacer.
            </Text>
            <View style={del.btnRow}>
              <TouchableOpacity style={del.cancelBtn} onPress={() => setConfirmando(false)} disabled={eliminando}>
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
  anioBadge: { backgroundColor:'#ede9fe', borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  anioBadgeText: { fontSize:13, fontWeight:'800', color:'#5b21b6', textTransform:'uppercase' },
  escuela: { fontSize:11, color:'#7c3aed', fontWeight:'700', textTransform:'uppercase', letterSpacing:0.3, flex:1 },
  materia: { fontSize:16, fontWeight:'800', color:'#111827', textTransform:'uppercase', letterSpacing:0.2 },
  ingresarRow: { flexDirection:'row', alignItems:'center', gap:3, marginTop:2 },
  ingresarText: { fontSize:12, color: COLORS.accent, fontWeight:'600' },
  actionsCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtn: {
    padding: 7,
    borderRadius: RADIUS.md,
    backgroundColor: '#ede9fe',
  },
  deleteBtn: {
    padding: 7,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
  },
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

// ══ CURSOS SCREEN ══════════════════════════════════════════════════════════
export default function CursosScreen() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [cursoParaEditar, setCursoParaEditar] = useState<Curso | null>(null);

  const fetchCursos = useCallback(async () => {
    try {
      const data = await apiFetch<Curso[]>('/cursos', { auth: true });
      setCursos(Array.isArray(data) ? data : []);
    } catch { setCursos([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCursos();
    }, [fetchCursos])
  );
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
                  onEditarHorarios={cToEdit => setCursoParaEditar(cToEdit)}
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

      <ModalEditarHorariosCurso
        visible={!!cursoParaEditar}
        curso={cursoParaEditar}
        onClose={() => setCursoParaEditar(null)}
        onGuardado={() => fetchCursos()}
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
