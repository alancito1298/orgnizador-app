import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

interface Curso { id: number; escuela: string; anio: string; materia: string; ruta: string; }
interface AgendaItem { id: number; fecha: string; descripcion: string; }
interface ActividadHoy { id: number; hora: string; materia: string; curso: string; escuela: string; cursoId?: number | null; }

const DIAS_MAP: Record<number, string> = { 1:'Lunes',2:'Martes',3:'Miercoles',4:'Jueves',5:'Viernes' };
const DIAS_COMPLETOS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const STICKER_BORDER_COLORS = ['#7c3aed','#059669','#4f46e5','#d97706'];

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

function formatAnio(anio: string): string {
  const n = parseInt(anio, 10);
  const nombres: Record<number,string> = {1:'1er Año',2:'2do Año',3:'3er Año',4:'4to Año',5:'5to Año',6:'6to Año',7:'7mo Año'};
  return isNaN(n) ? anio : (nombres[n] || `${n}° Año`);
}

// ── Almanaque widget (fiel al web) ─────────────────────────────────────────
function Almanaque() {
  const hoy = new Date();
  const mes = MESES[hoy.getMonth()].slice(0, 3).toUpperCase();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const diaNombre = DIAS_COMPLETOS[hoy.getDay()].toUpperCase();
  const anio = hoy.getFullYear();

  return (
    <View style={al.wrap}>
      {/* Cabecera violeta con "anillas" */}
      <View style={al.head}>
        <View style={al.anillasRow}>
          <View style={al.anilla} />
          <View style={al.anilla} />
        </View>
        <Text style={al.mes}>{mes}</Text>
      </View>
      {/* Hoja */}
      <View style={al.body}>
        <Text style={al.diaNum}>{dia}</Text>
        <Text style={al.diaNombre}>{diaNombre}</Text>
        <Text style={al.anioTxt}>{anio}</Text>
      </View>
    </View>
  );
}

const al = StyleSheet.create({
  wrap: {
    width: 72, borderRadius: RADIUS.lg, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#7c3aed', shadowOffset:{width:0,height:3}, shadowOpacity:0.15, shadowRadius:8, elevation:4,
    borderWidth:1, borderColor:'rgba(124,58,237,0.12)',
  },
  head: { backgroundColor: COLORS.accent, paddingBottom: 4, paddingTop: 6, alignItems:'center' },
  anillasRow: { flexDirection:'row', justifyContent:'space-around', width:'100%', paddingHorizontal:12, marginBottom:3 },
  anilla: { width:6, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.6)' },
  mes: { color:'#fff', fontSize:10, fontWeight:'800', letterSpacing:2, lineHeight:12 },
  body: { backgroundColor:'#fff', alignItems:'center', paddingVertical:8, gap:1 },
  diaNum: { fontSize:28, fontWeight:'800', color: COLORS.onSurface, lineHeight:30, letterSpacing:-1 },
  diaNombre: { fontSize:9, fontWeight:'800', color: COLORS.accent, letterSpacing:1 },
  anioTxt: { fontSize:9, fontWeight:'600', color: COLORS.secondary },
});

// ── Sticker de actividad (carrusel horizontal, fiel al web) ────────────────
function StickerActividad({ act, index, onPress }: { act: ActividadHoy; index: number; onPress: () => void }) {
  const borderColor = STICKER_BORDER_COLORS[index % STICKER_BORDER_COLORS.length];
  return (
    <TouchableOpacity style={[sk.card, { borderLeftColor: borderColor }]} onPress={onPress} activeOpacity={0.85}>
      <View style={sk.topRow}>
        <View style={sk.horaBox}>
          <Ionicons name="time-outline" size={11} color={COLORS.accent} />
          <Text style={sk.horaText}>{act.hora}</Text>
        </View>
        {act.curso ? (
          <View style={sk.cursoBadge}>
            <Text style={sk.cursoText} numberOfLines={1}>{formatAnio(act.curso)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={sk.materia} numberOfLines={1}>{act.materia}</Text>
      {act.escuela ? (
        <View style={sk.escuelaRow}>
          <Ionicons name="business-outline" size={11} color={COLORS.secondary} />
          <Text style={sk.escuela} numberOfLines={1}>{act.escuela}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={sk.btn} onPress={onPress} activeOpacity={0.8}>
        <Text style={sk.btnText}>Ir al curso</Text>
        <Ionicons name="arrow-forward" size={11} color={COLORS.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const sk = StyleSheet.create({
  card: {
    width: 220, backgroundColor:'#f5f3ff',
    borderRadius: RADIUS.xl, padding: SPACING.md,
    borderLeftWidth: 5, marginRight: SPACING.sm,
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:3,
    justifyContent:'space-between', gap: 6,
  },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  horaBox: { flexDirection:'row', alignItems:'center', gap:3 },
  horaText: { fontSize:11, fontWeight:'800', color: COLORS.accent },
  cursoBadge: {
    backgroundColor:'rgba(124,58,237,0.1)', borderRadius:6,
    paddingHorizontal:8, paddingVertical:2, maxWidth:90,
  },
  cursoText: { fontSize:10, fontWeight:'800', color: COLORS.accent },
  materia: { fontSize:13, fontWeight:'800', color: COLORS.onSurface, textTransform:'uppercase', letterSpacing:0.3 },
  escuelaRow: { flexDirection:'row', alignItems:'center', gap:4 },
  escuela: { fontSize:11, color: COLORS.secondary, fontWeight:'500', flex:1 },
  btn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4,
    backgroundColor:'#fff', borderRadius: RADIUS.md, paddingVertical:7,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:3, elevation:1,
    marginTop:2,
  },
  btnText: { fontSize:10, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
});

// ── Card de Curso (grid 2 columnas, fiel al web) ───────────────────────────
function CursoCard({ curso, onPress }: { curso: Curso; onPress: () => void }) {
  return (
    <TouchableOpacity style={cc.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cc.topRow}>
        <View style={cc.iconBox}>
          <Ionicons name={iconoPorMateria(curso.materia)} size={22} color={COLORS.accent} />
        </View>
        <View style={cc.anioBadge}>
          <Text style={cc.anioText}>{formatAnio(curso.anio)}</Text>
        </View>
      </View>
      <View style={cc.info}>
        <Text style={cc.materia} numberOfLines={1}>{curso.materia}</Text>
        <View style={cc.escuelaRow}>
          <Ionicons name="business-outline" size={12} color={COLORS.secondary} />
          <Text style={cc.escuela} numberOfLines={1}>{curso.escuela}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    flex:1, backgroundColor:'#f5f3ff', borderRadius: RADIUS.xl, padding: SPACING.md,
    gap: SPACING.sm,
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:8, elevation:3,
    borderWidth:1, borderColor:'rgba(124,58,237,0.1)',
  },
  topRow: { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
  iconBox: {
    width:40, height:40, borderRadius: RADIUS.lg,
    backgroundColor:'rgba(124,58,237,0.1)', alignItems:'center', justifyContent:'center',
  },
  anioBadge: {
    backgroundColor:'rgba(124,58,237,0.1)', borderRadius:6,
    paddingHorizontal:8, paddingVertical:2, maxWidth:80,
  },
  anioText: { fontSize:10, fontWeight:'800', color: COLORS.accent },
  info: { gap:4 },
  materia: { fontSize:13, fontWeight:'800', color: COLORS.onSurface },
  escuelaRow: { flexDirection:'row', alignItems:'center', gap:4 },
  escuela: { fontSize:11, color: COLORS.secondary, fontWeight:'500', flex:1 },
});

// ── Card de menú de navegación (fiel al web: ícono + label en fila) ────────
function NavMenuItem({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={nm.row} onPress={onPress} activeOpacity={0.8}>
      <View style={nm.iconBox}>
        <Ionicons name={icon} size={20} color={COLORS.accent} />
      </View>
      <Text style={nm.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
    </TouchableOpacity>
  );
}

const nm = StyleSheet.create({
  row: {
    flexDirection:'row', alignItems:'center', gap: SPACING.sm,
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2,
  },
  iconBox: {
    width:32, height:32, borderRadius: RADIUS.md,
    backgroundColor:'rgba(124,58,237,0.1)', alignItems:'center', justifyContent:'center',
  },
  label: { flex:1, fontSize:13, fontWeight:'800', color: COLORS.accent },
});

// ══ HOME SCREEN ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { docente } = useAuthStore();

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [actividadesHoy, setActividadesHoy] = useState<ActividadHoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hoy = new Date();
  const diaHoyKey = DIAS_MAP[hoy.getDay()];
  const diaSemanaCompleto = DIAS_COMPLETOS[hoy.getDay()];
  const currentMonth = hoy.getMonth();
  const currentYear = hoy.getFullYear();
  const anioEscolar = `${currentYear} - ${currentYear + 1}`;

  // Primer nombre del docente
  const primerNombre = docente?.nombre
    ? docente.nombre.trim().split(' ')[0].charAt(0).toUpperCase() +
      docente.nombre.trim().split(' ')[0].slice(1).toLowerCase()
    : 'Docente';

  const fetchAll = useCallback(async () => {
    try {
      const [cursosRes, agendaRes, horariosRes] = await Promise.allSettled([
        apiFetch<Curso[]>('/cursos', { auth: true }),
        apiFetch<AgendaItem[]>('/agenda', { auth: true }),
        apiFetch<any[]>('/horarios', { auth: true }),
      ]);

      const cursosList = cursosRes.status === 'fulfilled' ? cursosRes.value : [];
      setCursos(cursosList);

      if (agendaRes.status === 'fulfilled') {
        const eventos = agendaRes.value.filter(a => {
          const [y, m] = a.fecha.split('T')[0].split('-').map(Number);
          return y === currentYear && m === currentMonth + 1;
        }).sort((a,b) => a.fecha.localeCompare(b.fecha));
        setAgenda(eventos);
      }

      if (horariosRes.status === 'fulfilled' && diaHoyKey) {
        const deHoy = horariosRes.value.filter((h: any) => h.dia === diaHoyKey);
        const parseadas: ActividadHoy[] = deHoy.map((h: any) => {
          let materia='', cursoTxt='', escuela='', cursoId: number|null=null;
          if (h.descripcion) {
            try {
              const p = JSON.parse(h.descripcion);
              materia = p.materia || ''; cursoTxt = p.curso || '';
              escuela = p.escuela || ''; cursoId = p.cursoId ? Number(p.cursoId) : null;
            } catch { materia = h.descripcion; }
          }
          // Buscar cursoId por nombre si no viene
          if (!cursoId && materia) {
            const found = cursosList.find(c => c.materia.toLowerCase().trim() === materia.toLowerCase().trim());
            if (found) cursoId = found.id;
          }
          return { id: h.id, hora: (h.hora||h.horaInicio||'').replace(/\s+/g,' ').trim(), materia: materia||'Clase', curso: cursoTxt, escuela, cursoId };
        }).sort((a: ActividadHoy, b: ActividadHoy) => {
          const na = parseFloat(a.hora.replace(':','.')), nb = parseFloat(b.hora.replace(':','.'));
          return isNaN(na)||isNaN(nb) ? a.hora.localeCompare(b.hora) : na-nb;
        });
        setActividadesHoy(parseadas);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [diaHoyKey, currentMonth, currentYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* ── HEADER: Saludo + Almanaque ── */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.saludo}>Hola {primerNombre}</Text>
            <View style={s.anioRow}>
              <Text style={s.anioText}>Año escolar: {anioEscolar}</Text>
              <View style={s.encursoBadge}>
                <View style={s.greenDot} />
                <Text style={s.encursoText}>En curso</Text>
              </View>
            </View>
          </View>
          <Almanaque />
        </View>

        {/* ── STICKERS DE HOY ── */}
        <View style={s.section}>
          {actividadesHoy.length > 0 ? (
            <>
              <View style={s.stickerHeader}>
                <View style={s.stickerTitleRow}>
                  <Ionicons name="reader-outline" size={14} color={COLORS.accent} />
                  <Text style={s.stickerTitle}>Recordatorio de Hoy ({diaSemanaCompleto})</Text>
                </View>
                <View style={s.clasesBadge}>
                  <Text style={s.clasesText}>{actividadesHoy.length} {actividadesHoy.length===1?'clase':'clases'}</Text>
                </View>
              </View>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.stickersScroll}
              >
                {actividadesHoy.map((act, i) => (
                  <StickerActividad
                    key={act.id}
                    act={act}
                    index={i}
                    onPress={() => {
                      if (act.cursoId) {
                        navigation.navigate('CursoDetalle', { cursoId: act.cursoId });
                      } else {
                        navigation.navigate('Cursos');
                      }
                    }}
                  />
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={s.sinClasesRow}>
              <Text style={s.coffeeEmoji}>☕</Text>
              <Text style={s.sinClasesText}>
                Hoy ({diaSemanaCompleto}) {diaHoyKey ? 'no tenés clases programadas en tu horario.' : 'es fin de semana.'}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Horario')}>
                <Text style={s.verHorarioLink}>Ver horario →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── MENÚ DE NAVEGACIÓN ── */}
        <View style={[s.card, s.section]}>
          <View style={s.menuTitleRow}>
            <Ionicons name="menu" size={16} color={COLORS.accent} />
            <Text style={s.menuTitle}>MENÚ</Text>
          </View>
          <View style={s.menuItems}>
            <NavMenuItem icon="calendar-outline"  label="Agenda"          onPress={() => navigation.navigate('Agenda')} />
            <NavMenuItem icon="school-outline"    label="Cursos"          onPress={() => navigation.navigate('Cursos')} />
            <NavMenuItem icon="document-text-outline" label="Planificaciones" onPress={() => navigation.navigate('Cursos')} />
            <NavMenuItem icon="time-outline"      label="Horarios"        onPress={() => navigation.navigate('Horario')} />
          </View>
        </View>

        {/* ── MIS CURSOS (Grid 2 columnas) ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>MIS CURSOS</Text>
            {cursos.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Cursos')}>
                <Text style={s.verTodos}>VER TODOS</Text>
              </TouchableOpacity>
            )}
          </View>

          {cursos.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="school-outline" size={28} color={COLORS.secondary} />
              <Text style={s.emptyText}>Aún no tenés cursos creados.</Text>
              <TouchableOpacity style={s.crearBtn} onPress={() => navigation.navigate('Cursos')}>
                <Text style={s.crearBtnText}>+ Crear Curso</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.cursosGrid}>
              {cursos.slice(0, 4).map((curso) => (
                <CursoCard
                  key={curso.id}
                  curso={curso}
                  onPress={() => navigation.navigate('CursoDetalle', { cursoId: curso.id, curso })}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── EVENTOS DEL MES ── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{agenda.length} EVENTOS PROGRAMADOS</Text>
            <TouchableOpacity style={s.agendarBtn} onPress={() => navigation.navigate('Agenda')}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.accent} />
              <Text style={s.agendarText}>Agendar</Text>
            </TouchableOpacity>
          </View>

          {agenda.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.secondary} />
              <Text style={s.emptyText}>No hay eventos agendados para este mes.</Text>
            </View>
          ) : (
            <View style={s.agendaList}>
              {agenda.slice(0, 5).map((ev) => {
                const partes = ev.fecha.split('T')[0].split('-');
                const diaNum = Number(partes[2]);
                const mesNum = Number(partes[1]) - 1;
                return (
                  <TouchableOpacity key={ev.id} style={s.agendaCard} onPress={() => navigation.navigate('Agenda')} activeOpacity={0.85}>
                    <View style={s.agendaDiaBox}>
                      <Text style={s.agendaDiaLabel}>DÍA</Text>
                      <Text style={s.agendaDiaNum}>{diaNum}</Text>
                    </View>
                    <View style={s.agendaInfo}>
                      <Text style={s.agendaDesc} numberOfLines={2}>{ev.descripcion}</Text>
                      <Text style={s.agendaFecha}>{diaNum} de {MESES[mesNum]}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={s.verAgendaBtn} onPress={() => navigation.navigate('Agenda')}>
            <Text style={s.verAgendaText}>VER AGENDA COMPLETA</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor: COLORS.background },
  scroll: { flex:1 },
  content: { padding: SPACING.xl, paddingTop: SPACING.lg },
  centered: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor: COLORS.background },

  // Header
  headerRow: { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom: SPACING.xl },
  headerLeft: { flex:1, gap: 6 },
  saludo: { fontSize:26, fontWeight:'800', color: COLORS.onSurface, letterSpacing:-0.5 },
  anioRow: { flexDirection:'row', alignItems:'center', gap: 8, flexWrap:'wrap' },
  anioText: { fontSize:12, color: COLORS.secondary, fontWeight:'500' },
  encursoBadge: {
    flexDirection:'row', alignItems:'center', gap:4,
    backgroundColor:'rgba(124,58,237,0.08)', borderRadius: RADIUS.full,
    paddingHorizontal:8, paddingVertical:3,
  },
  greenDot: { width:6, height:6, borderRadius:3, backgroundColor:'#22c55e' },
  encursoText: { fontSize:10, fontWeight:'700', color: COLORS.accent },

  // Stickers
  section: { marginBottom: SPACING.xl },
  stickerHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.sm },
  stickerTitleRow: { flexDirection:'row', alignItems:'center', gap:5 },
  stickerTitle: { fontSize:11, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
  clasesBadge: {
    backgroundColor:'rgba(124,58,237,0.1)', borderRadius: RADIUS.full,
    paddingHorizontal:10, paddingVertical:3,
  },
  clasesText: { fontSize:10, fontWeight:'800', color: COLORS.accent },
  stickersScroll: { paddingBottom: SPACING.sm },
  sinClasesRow: {
    flexDirection:'row', alignItems:'center', gap: SPACING.sm,
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.lg,
    padding: SPACING.md, flexWrap:'wrap',
  },
  coffeeEmoji: { fontSize:18 },
  sinClasesText: { flex:1, fontSize:12, color: COLORS.secondary, fontWeight:'600', lineHeight:18 },
  verHorarioLink: { fontSize:11, fontWeight:'800', color: COLORS.accent },

  // Menú nav card
  card: {
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.xl, padding: SPACING.md,
    shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:8, elevation:3,
  },
  menuTitleRow: { flexDirection:'row', alignItems:'center', gap:6, marginBottom: SPACING.sm },
  menuTitle: { fontSize:12, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:1 },
  menuItems: { gap: SPACING.sm },

  // Secciones
  sectionTitleRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize:11, fontWeight:'800', color: COLORS.secondary, textTransform:'uppercase', letterSpacing:1 },
  verTodos: { fontSize:11, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },

  // Grid cursos
  cursosGrid: { flexDirection:'row', flexWrap:'wrap', gap: SPACING.sm },

  // Botones empty state
  emptyCard: {
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.xl,
    padding: SPACING.xl, alignItems:'center', gap: SPACING.sm,
  },
  emptyText: { fontSize:12, color: COLORS.secondary, fontWeight:'500', textAlign:'center' },
  crearBtn: {
    backgroundColor:'#fff', borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical:8,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2,
  },
  crearBtnText: { fontSize:12, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },

  // Agenda
  agendarBtn: { flexDirection:'row', alignItems:'center', gap:4 },
  agendarText: { fontSize:13, fontWeight:'700', color: COLORS.accent },
  agendaList: { gap: SPACING.sm },
  agendaCard: {
    flexDirection:'row', alignItems:'center', gap: SPACING.md,
    backgroundColor:'#f5f3ff', borderRadius: RADIUS.xl, padding: SPACING.md,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2,
  },
  agendaDiaBox: {
    width:48, height:48, borderRadius: RADIUS.lg,
    backgroundColor:'rgba(124,58,237,0.1)', alignItems:'center', justifyContent:'center', gap:1,
  },
  agendaDiaLabel: { fontSize:9, fontWeight:'700', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
  agendaDiaNum: { fontSize:18, fontWeight:'800', color: COLORS.accent, lineHeight:20 },
  agendaInfo: { flex:1, gap:3 },
  agendaDesc: { fontSize:13, fontWeight:'700', color: COLORS.onSurface, lineHeight:18 },
  agendaFecha: { fontSize:11, color: COLORS.secondary },
  verAgendaBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
    marginTop: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth:1, borderTopColor:'rgba(124,58,237,0.15)',
  },
  verAgendaText: { fontSize:12, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },
});
