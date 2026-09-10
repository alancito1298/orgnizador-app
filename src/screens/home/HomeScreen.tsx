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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { COLORS, RADIUS, SPACING, NEU } from '../../theme';
import ModalCrearCurso from '../../components/cursos/ModalCrearCurso';
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

function normalizarDia(dia: string | null | undefined): string {
  if (!dia) return '';
  const clean = dia.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (clean.startsWith('lun')) return 'Lunes';
  if (clean.startsWith('mar')) return 'Martes';
  if (clean.startsWith('mie')) return 'Miercoles';
  if (clean.startsWith('jue')) return 'Jueves';
  if (clean.startsWith('vie')) return 'Viernes';
  return dia.trim();
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
    width: 74, borderRadius: RADIUS.lg, overflow: 'hidden',
    ...NEU.raisedCard,
  },
  head: { backgroundColor: COLORS.accent, paddingBottom: 4, paddingTop: 6, alignItems:'center' },
  anillasRow: { flexDirection:'row', justifyContent:'space-around', width:'100%', paddingHorizontal:12, marginBottom:3 },
  anilla: { width:6, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.6)' },
  mes: { color:'#fff', fontSize:11, fontWeight:'800', letterSpacing:2, lineHeight:13 },
  body: { backgroundColor:'#fff', alignItems:'center', paddingVertical:8, gap:1 },
  diaNum: { fontSize:28, fontWeight:'800', color: COLORS.onSurface, lineHeight:30, letterSpacing:-1 },
  diaNombre: { fontSize:10, fontWeight:'800', color: COLORS.accent, letterSpacing:0.8 },
  anioTxt: { fontSize:10, fontWeight:'600', color: COLORS.secondary },
});

// ── Sticker de actividad (carrusel horizontal, fiel al web) ────────────────
function StickerActividad({ act, onPress }: { act: ActividadHoy; index?: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={sk.card} onPress={onPress} activeOpacity={0.85}>
      <View style={sk.topRow}>
        <View style={sk.horaBox}>
          <Ionicons name="time-outline" size={12} color={COLORS.accent} />
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
          <Ionicons name="business-outline" size={12} color={COLORS.secondary} />
          <Text style={sk.escuela} numberOfLines={1}>{act.escuela}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const sk = StyleSheet.create({
  card: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#ede9fe',
    justifyContent: 'space-between',
    minHeight: 95,
    gap: 6,
  },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  horaBox: { flexDirection:'row', alignItems:'center', gap:3 },
  horaText: { fontSize:12, fontWeight:'800', color: COLORS.accent },
  cursoBadge: {
    backgroundColor: '#ede9fe', borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 3, maxWidth: 110,
  },
  cursoText: { fontSize: 13, fontWeight: '800', color: COLORS.accent },
  materia: { fontSize:14, fontWeight:'800', color: COLORS.onSurface, textTransform:'uppercase', letterSpacing:0.3 },
  escuelaRow: { flexDirection:'row', alignItems:'center', gap:4 },
  escuela: { fontSize:12, color: COLORS.secondary, fontWeight:'500', flex:1 },
});

// ── Card de Curso (grid 2 columnas) ─────────────────────────────────────────
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
        {curso.escuela ? (
          <View style={cc.escuelaRow}>
            <Ionicons name="business-outline" size={12} color={COLORS.secondary} />
            <Text style={cc.escuela} numberOfLines={1}>{curso.escuela}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Card "+ Agregar nuevo" (cuarto elemento del grid) ──────────────────────
function AgregarNuevoCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={cc.agregarCard} onPress={onPress} activeOpacity={0.85}>
      <View style={cc.agregarIconBox}>
        <Ionicons name="add" size={24} color={COLORS.accent} />
      </View>
      <Text style={cc.agregarTitle}>+ Agregar nuevo</Text>
      <Text style={cc.agregarSub}>Crear un curso</Text>
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    width: '48.5%',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    justifyContent: 'space-between',
    minHeight: 115,
    gap: SPACING.sm,
    ...NEU.raisedCard,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    ...NEU.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anioBadge: {
    ...NEU.inset,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anioText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: 0.3,
  },
  info: {
    gap: 3,
  },
  materia: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.onSurface,
    textTransform: 'uppercase',
  },
  escuelaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  escuela: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '500',
    flex: 1,
  },

  // Card "+ Agregar nuevo"
  agregarCard: {
    width: '48.5%',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 115,
    gap: 6,
    ...NEU.raisedCard,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  agregarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    ...NEU.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agregarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
    textAlign: 'center',
  },
  agregarSub: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
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
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    ...NEU.raisedCard,
  },
  iconBox: {
    width:32, height:32, borderRadius: RADIUS.md,
    ...NEU.inset,
    alignItems:'center', justifyContent:'center',
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
  const [modalCrear, setModalCrear] = useState(false);

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
      console.log('[HomeScreen] fetchAll starting...');
      const [cursosRes, agendaRes, horariosRes] = await Promise.allSettled([
        apiFetch<Curso[]>('/cursos', { auth: true }),
        apiFetch<AgendaItem[]>('/agenda', { auth: true }),
        apiFetch<any[]>('/horarios', { auth: true }),
      ]);

      console.log('[HomeScreen] cursosRes status:', cursosRes.status, cursosRes.status === 'fulfilled' ? cursosRes.value?.length : (cursosRes as any).reason);
      console.log('[HomeScreen] agendaRes status:', agendaRes.status, agendaRes.status === 'fulfilled' ? agendaRes.value?.length : (agendaRes as any).reason);
      console.log('[HomeScreen] horariosRes status:', horariosRes.status, horariosRes.status === 'fulfilled' ? horariosRes.value?.length : (horariosRes as any).reason);

      const cursosList = cursosRes.status === 'fulfilled' ? cursosRes.value : [];
      setCursos(cursosList);

      if (agendaRes.status === 'fulfilled') {
        const hoyDate = new Date();
        const ayer = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - 1);
        const posterior15 = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() + 15);
        const toKey = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const desde = toKey(ayer);
        const hasta = toKey(posterior15);

        const rawAgenda = Array.isArray(agendaRes.value) ? agendaRes.value : [];
        const eventos = rawAgenda
          .filter(a => {
            if (!a.fecha) return false;
            const key = a.fecha.split('T')[0];
            return key >= desde && key <= hasta;
          })
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        setAgenda(eventos);
      }

      if (horariosRes.status === 'fulfilled' && diaHoyKey) {
        const rawHorarios = Array.isArray(horariosRes.value) ? horariosRes.value : [];
        const deHoy = rawHorarios.filter((h: any) => normalizarDia(h.dia) === diaHoyKey);
        const parseadas: ActividadHoy[] = deHoy.map((h: any) => {
          let materia='', cursoTxt='', escuela='', cursoId: number|null=null;
          if (h.descripcion) {
            try {
              const p = JSON.parse(h.descripcion);
              if (typeof p === 'object' && p !== null) {
                materia = p.materia || ''; cursoTxt = p.curso || '';
                escuela = p.escuela || ''; cursoId = p.cursoId ? Number(p.cursoId) : null;
              }
            } catch {
              const partes = String(h.descripcion).split(/\r?\n| - | — /);
              if (partes.length >= 2) {
                materia = partes[0].trim();
                cursoTxt = partes[1].trim();
                escuela = partes.slice(2).join(' ').trim();
              } else {
                materia = String(h.descripcion).trim();
              }
            }
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

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );
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
        {/* ── HEADER: Saludo + Perfil + Almanaque ── */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <View style={s.saludoRow}>
              <TouchableOpacity
                style={s.avatarBtn}
                onPress={() => navigation.navigate('Perfil')}
                activeOpacity={0.8}
              >
                <Text style={s.avatarInitials}>
                  {((docente?.nombre?.[0] || 'D') + (docente?.apellido?.[0] || '')).toUpperCase()}
                </Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.saludo} numberOfLines={1}>Hola {primerNombre}</Text>
                <View style={s.anioRow}>
                  <Text style={s.anioText}>Año escolar: {anioEscolar}</Text>
                  <View style={s.encursoBadge}>
                    <View style={s.greenDot} />
                    <Text style={s.encursoText}>En curso</Text>
                  </View>
                </View>
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
              <View style={s.stickersGrid}>
                {actividadesHoy.map((act) => (
                  <StickerActividad
                    key={act.id}
                    act={act}
                    onPress={() => {
                      if (act.cursoId) {
                        navigation.navigate('CursoDetalle', { cursoId: act.cursoId });
                      } else {
                        navigation.navigate('Cursos');
                      }
                    }}
                  />
                ))}
              </View>
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
            <NavMenuItem icon="sparkles-outline"  label="Asistente Pedagógico IA" onPress={() => navigation.navigate('ChatbotIA')} />
            <NavMenuItem icon="person-circle-outline" label="Mi Perfil"   onPress={() => navigation.navigate('Perfil')} />
          </View>
        </View>

        {/* ── MIS CURSOS (Grid 2 columnas con "+ Ver todos" como 3er elemento) ── */}
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
              <TouchableOpacity style={s.crearBtn} onPress={() => setModalCrear(true)}>
                <Text style={s.crearBtnText}>+ Crear Curso</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.cursosGrid}>
              {cursos.slice(0, 3).map((curso) => (
                <CursoCard
                  key={curso.id}
                  curso={curso}
                  onPress={() => navigation.navigate('CursoDetalle', { cursoId: curso.id, curso })}
                />
              ))}
              <AgregarNuevoCard onPress={() => setModalCrear(true)} />
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
              <Text style={s.emptyText}>No hay eventos agendados desde ayer hasta los próximos 15 días.</Text>
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

      <ModalCrearCurso
        visible={modalCrear}
        onClose={() => setModalCrear(false)}
        onCreado={(nuevoCurso) => {
          setCursos((prev) => [nuevoCurso, ...prev]);
          fetchAll();
        }}
      />
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
  saludoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#c4b5fd',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  saludo: { fontSize:22, fontWeight:'800', color: COLORS.onSurface, letterSpacing:-0.5 },
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
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
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
    borderRadius: RADIUS.xl, padding: SPACING.md,
    ...NEU.raised,
  },
  menuTitleRow: { flexDirection:'row', alignItems:'center', gap:6, marginBottom: SPACING.sm },
  menuTitle: { fontSize:12, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:1 },
  menuItems: { gap: SPACING.sm },

  // Secciones
  sectionTitleRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize:11, fontWeight:'800', color: COLORS.secondary, textTransform:'uppercase', letterSpacing:1 },
  verTodos: { fontSize:11, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },

  // Grid cursos (2 columnas)
  cursosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },

  // Botones empty state
  emptyCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl, alignItems:'center', gap: SPACING.sm,
    ...NEU.inset,
  },
  emptyText: { fontSize:12, color: COLORS.secondary, fontWeight:'500', textAlign:'center' },
  crearBtn: {
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical:8,
    ...NEU.raisedCard,
  },
  crearBtnText: { fontSize:12, fontWeight:'800', color: COLORS.accent, textTransform:'uppercase', letterSpacing:0.5 },

  // Agenda
  agendarBtn: { flexDirection:'row', alignItems:'center', gap:4 },
  agendarText: { fontSize:13, fontWeight:'700', color: COLORS.accent },
  agendaList: { gap: SPACING.sm },
  agendaCard: {
    flexDirection:'row', alignItems:'center', gap: SPACING.md,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    ...NEU.raisedCard,
  },
  agendaDiaBox: {
    width:48, height:48, borderRadius: RADIUS.lg,
    ...NEU.inset,
    alignItems:'center', justifyContent:'center', gap:1,
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
