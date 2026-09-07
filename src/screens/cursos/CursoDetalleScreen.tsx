import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { apiFetch } from '../../api/client';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import ImportarAlumnosModal from '../../components/alumnos/ImportarAlumnosModal';
import PasoConceptoModal from '../../components/alumnos/PasoConceptoModal';
import {
  exportarAsistenciasCsv,
  exportarCalificacionesCsv,
  exportarInformePedagogico,
} from '../../utils/exportUtils';
import { COLORS, RADIUS, SPACING } from '../../theme';
import type { AppStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AppStackParamList>;

interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string | null;
  contacto?: string | null;
}

interface Inscripcion {
  id: number;
  alumnoId: number;
  cursoId: number;
  alumno: Alumno;
}

interface Asistencia {
  id: number;
  alumnoCursoId: number;
  fecha: string;
  estado: string;
  trimestre?: number;
}

interface Calificacion {
  id: number;
  alumnoCursoId: number;
  valor: number;
  fecha: string;
  tipo: string;
  trimestre: number;
}

type TabType = 'alumnos' | 'asistencia' | 'calificaciones' | 'planilla';
type CriterioOrden = 'alfabetico-asc' | 'alfabetico-desc' | 'asistencia' | 'calificaciones';

function formatAnio(anio: string): string {
  const n = parseInt(anio, 10);
  const nombres: Record<number, string> = {
    1: '1er Año', 2: '2do Año', 3: '3er Año', 4: '4to Año', 5: '5to Año', 6: '6to Año', 7: '7mo Año'
  };
  return isNaN(n) ? anio : (nombres[n] || `${n}° Año`);
}

const ESTADOS_ASISTENCIA = [
  { key: 'presente', label: 'Presente', color: '#16a34a', bg: '#dcfce7' },
  { key: 'ausente', label: 'Ausente', color: '#dc2626', bg: '#fee2e2' },
  { key: 'media_falta', label: '1/2 Falta', color: '#d97706', bg: '#fef3c7' },
  { key: 'justificada', label: 'Justif.', color: '#2563eb', bg: '#dbeafe' },
];

export default function CursoDetalleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { cursoId, curso: cursoParam } = route.params || {};

  const [curso, setCurso] = useState<any>(cursoParam || null);
  const [activeTab, setActiveTab] = useState<TabType>('alumnos');
  const [trimestre, setTrimestre] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Datos
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>('alfabetico-asc');

  // Modal Alumno (Crear / Editar)
  const [modalAlumno, setModalAlumno] = useState(false);
  const [editandoAlumnoId, setEditandoAlumnoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [contacto, setContacto] = useState('');
  const [guardandoAlumno, setGuardandoAlumno] = useState(false);

  // Modal Perfil Detallado de Alumno
  const [perfilAlumno, setPerfilAlumno] = useState<{ insc: Inscripcion; stats: any } | null>(null);

  // Asistencia del día actual
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fechaAsistencia, setFechaAsistencia] = useState(hoyStr);
  const [asistenciasHoy, setAsistenciasHoy] = useState<Record<number, string>>({});
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  // Modal Nueva Calificación
  const [modalNuevaNota, setModalNuevaNota] = useState(false);
  const [alumnoSeleccionadoId, setAlumnoSeleccionadoId] = useState<number | null>(null);
  const [tipoNota, setTipoNota] = useState('Evaluación');
  const [valorNota, setValorNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  // Modales de Importación, Concepto y Descargas
  const [importarModalAbierto, setImportarModalAbierto] = useState(false);
  const [conceptoModalAbierto, setConceptoModalAbierto] = useState(false);
  const [menuDescargasAbierto, setMenuDescargasAbierto] = useState(false);

  // Carga de datos
  const cargarDatos = useCallback(async () => {
    if (!cursoId) return;
    try {
      const [cRes, iRes, aRes, calRes] = await Promise.allSettled([
        !curso ? apiFetch<any>(`/cursos/${cursoId}`, { auth: true }) : Promise.resolve(curso),
        apiFetch<Inscripcion[]>(`/inscripciones/curso/${cursoId}`, { auth: true }),
        apiFetch<Asistencia[]>(`/asistencias/curso/${cursoId}`, { auth: true }),
        apiFetch<Calificacion[]>(`/calificaciones/curso/${cursoId}`, { auth: true }),
      ]);

      if (cRes.status === 'fulfilled' && cRes.value) setCurso(cRes.value);

      let inscList: Inscripcion[] = [];
      if (iRes.status === 'fulfilled' && Array.isArray(iRes.value)) {
        inscList = iRes.value;
        setInscripciones(inscList);
      }

      let asisList: Asistencia[] = [];
      if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) {
        asisList = aRes.value;
        setAsistencias(asisList);
      }

      if (calRes.status === 'fulfilled' && Array.isArray(calRes.value)) {
        setCalificaciones(calRes.value);
      }

      const mapaHoy: Record<number, string> = {};
      inscList.forEach((insc) => {
        const existente = asisList.find((a) => a.alumnoCursoId === insc.id && a.fecha.startsWith(fechaAsistencia));
        mapaHoy[insc.id] = existente ? existente.estado : 'presente';
      });
      setAsistenciasHoy(mapaHoy);
    } catch (e) {
      console.error('Error al cargar detalle del curso:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cursoId, fechaAsistencia]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarDatos();
  };

  // Cálculo de estadísticas por alumno
  const getStatsAlumno = useCallback((alumnoCursoId: number) => {
    const asis = asistencias.filter((a) => a.alumnoCursoId === alumnoCursoId);
    const total = asis.length;
    const presentes = asis.filter((a) => a.estado === 'presente' || a.estado.startsWith('presente_')).length;
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : null;

    const notas = calificaciones.filter((c) => c.alumnoCursoId === alumnoCursoId);
    const notasTrim = notas.filter((c) => Number(c.trimestre) === trimestre);
    const suma = notas.reduce((acc, n) => acc + Number(n.valor), 0);
    const promedio = notas.length > 0 ? (suma / notas.length).toFixed(1) : null;

    const sumaTrim = notasTrim.reduce((acc, n) => acc + Number(n.valor), 0);
    const promedioTrim = notasTrim.length > 0 ? (sumaTrim / notasTrim.length).toFixed(1) : null;

    return { total, presentes, porcentaje, notas, promedio, notasTrim, promedioTrim };
  }, [asistencias, calificaciones, trimestre]);

  // Alumnos destacados para la sección Hero
  const destacados = useMemo(() => {
    if (inscripciones.length === 0) return { topAsistencia: null, topNota: null };

    const conStats = inscripciones.map((insc) => ({
      insc,
      stats: getStatsAlumno(insc.id),
    }));

    // Top Asistencia
    const ordAsist = [...conStats].sort((a, b) => (b.stats.porcentaje ?? -1) - (a.stats.porcentaje ?? -1));
    const topAsistencia = ordAsist[0]?.stats.porcentaje !== null ? ordAsist[0] : null;

    // Top Notas
    const ordNotas = [...conStats].sort(
      (a, b) => parseFloat(b.stats.promedio ?? '-1') - parseFloat(a.stats.promedio ?? '-1')
    );
    const topNota = ordNotas[0]?.stats.promedio !== null ? ordNotas[0] : null;

    return { topAsistencia, topNota };
  }, [inscripciones, getStatsAlumno]);

  // Alumnos filtrados y ordenados
  const alumnosProcesados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let lista = inscripciones.filter((i) => {
      const full = `${i.alumno?.apellido || ''} ${i.alumno?.nombre || ''} ${i.alumno?.dni || ''}`.toLowerCase();
      return full.includes(q);
    });

    lista.sort((a, b) => {
      if (criterioOrden === 'alfabetico-asc') {
        return (a.alumno?.apellido || '').localeCompare(b.alumno?.apellido || '');
      }
      if (criterioOrden === 'alfabetico-desc') {
        return (b.alumno?.apellido || '').localeCompare(a.alumno?.apellido || '');
      }
      if (criterioOrden === 'asistencia') {
        const sa = getStatsAlumno(a.id).porcentaje ?? -1;
        const sb = getStatsAlumno(b.id).porcentaje ?? -1;
        return sb - sa;
      }
      if (criterioOrden === 'calificaciones') {
        const pa = parseFloat(getStatsAlumno(a.id).promedio ?? '-1');
        const pb = parseFloat(getStatsAlumno(b.id).promedio ?? '-1');
        return pb - pa;
      }
      return 0;
    });

    return lista;
  }, [inscripciones, busqueda, criterioOrden, getStatsAlumno]);

  // Estado de Asistencia de Hoy (Cargadas, Pendiente, Sin clases hoy)
  const estadoAsistenciaHoy = useMemo(() => {
    const hoy = new Date();
    const cargadasHoy = asistencias.some((a) => a.fecha.startsWith(hoyStr));
    if (cargadasHoy) return 'cargadas';
    if (hoy.getDay() >= 1 && hoy.getDay() <= 5) return 'pendiente';
    return 'sin_clases';
  }, [asistencias, hoyStr]);

  // Guardar Alumno (Crear o Editar)
  const handleGuardarAlumno = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert('Datos requeridos', 'Por favor ingresá nombre y apellido.');
      return;
    }
    setGuardandoAlumno(true);
    try {
      if (editandoAlumnoId) {
        await apiFetch(`/alumnos/${editandoAlumnoId}`, {
          method: 'PUT',
          auth: true,
          body: JSON.stringify({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim() || undefined,
            contacto: contacto.trim() || undefined,
          }),
        });
      } else {
        const nuevo = await apiFetch<Alumno>('/alumnos', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim() || undefined,
            contacto: contacto.trim() || undefined,
          }),
        });
        await apiFetch('/inscripciones', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({ alumnoId: nuevo.id, cursoId }),
        });
      }

      setNombre('');
      setApellido('');
      setDni('');
      setContacto('');
      setEditandoAlumnoId(null);
      setModalAlumno(false);
      cargarDatos();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar el alumno.');
    } finally {
      setGuardandoAlumno(false);
    }
  };

  const handleEditarAlumno = (a: Alumno) => {
    setEditandoAlumnoId(a.id);
    setNombre(a.nombre || '');
    setApellido(a.apellido || '');
    setDni(a.dni || '');
    setContacto(a.contacto || '');
    setModalAlumno(true);
  };

  // Desvincular Alumno
  const handleEliminarAlumno = (inscripcionId: number, nombreCompleto: string) => {
    Alert.alert(
      '¿Desvincular alumno?',
      `Esta acción desvinculará a ${nombreCompleto} de este curso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/inscripciones/${inscripcionId}`, { method: 'DELETE', auth: true });
              cargarDatos();
            } catch {
              Alert.alert('Error', 'No se pudo desvincular al alumno.');
            }
          },
        },
      ]
    );
  };

  // Guardar Asistencias
  const handleGuardarAsistencia = async () => {
    setGuardandoAsistencia(true);
    try {
      const promesas = inscripciones.map(async (insc) => {
        const estado = asistenciasHoy[insc.id] || 'presente';
        const existente = asistencias.find((a) => a.alumnoCursoId === insc.id && a.fecha.startsWith(fechaAsistencia));

        if (existente) {
          return apiFetch(`/asistencias/${existente.id}`, {
            method: 'PUT',
            auth: true,
            body: JSON.stringify({ estado }),
          }).catch(() => null);
        } else {
          return apiFetch('/asistencias', {
            method: 'POST',
            auth: true,
            body: JSON.stringify({
              fecha: fechaAsistencia,
              estado,
              trimestre,
              alumnoCursoId: insc.id,
            }),
          }).catch(() => null);
        }
      });

      await Promise.all(promesas);
      Alert.alert('¡Éxito!', '✅ Asistencias guardadas correctamente.');
      cargarDatos();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar las asistencias.');
    } finally {
      setGuardandoAsistencia(false);
    }
  };

  // Guardar Nota
  const handleGuardarNota = async () => {
    if (!alumnoSeleccionadoId || !valorNota.trim()) {
      Alert.alert('Datos requeridos', 'Por favor seleccioná el alumno e ingresá la calificación.');
      return;
    }
    const valNum = parseFloat(valorNota.replace(',', '.'));
    if (isNaN(valNum) || valNum < 1 || valNum > 10) {
      Alert.alert('Nota inválida', 'La nota debe ser un número entre 1 y 10.');
      return;
    }

    setGuardandoNota(true);
    try {
      await apiFetch('/calificaciones', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          alumnoCursoId: alumnoSeleccionadoId,
          tipo: tipoNota,
          valor: valNum,
          fecha: new Date().toISOString().split('T')[0],
          trimestre,
        }),
      });

      setValorNota('');
      setModalNuevaNota(false);
      Alert.alert('¡Éxito!', 'Calificación registrada con éxito.');
      cargarDatos();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar la calificación.');
    } finally {
      setGuardandoNota(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Cargando aula escolar...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── BARRA SUPERIOR CON BACK ── */}
      <View style={s.topNav}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={s.topNavTitle} numberOfLines={1}>{curso?.materia || 'AULA'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* ── SECCIÓN 1: HEADER DEL CURSO (Fiel al web: neumorphic raised 3xl) ── */}
        <View style={s.headerCard}>
          <View style={s.headerTopRow}>
            <View style={s.headerTitleCol}>
              <Text style={s.mainSectionTitle}>ALUMNOS</Text>
              <View style={s.headerSubRow}>
                {curso?.anio && (
                  <View style={s.headerAnioBadge}>
                    <Text style={s.headerAnioText}>{formatAnio(curso.anio)}</Text>
                  </View>
                )}
                <Text style={s.headerMateriaText}>{curso?.materia?.toUpperCase()}</Text>
                <Text style={s.headerEscuelaText}>— {curso?.escuela}</Text>
              </View>
            </View>
          </View>

          <View style={s.headerDivider} />

          {/* Subheader: Año Escolar + Selector de Trimestre */}
          <View style={s.headerBottomRow}>
            <View style={s.anioEscolarRow}>
              <Text style={s.anioEscolarText}>Año escolar: 2026 - 2027</Text>
              <View style={s.enCursoBadge}>
                <View style={s.greenDot} />
                <Text style={s.enCursoText}>En curso</Text>
              </View>
            </View>

            <View style={s.trimestreGroup}>
              <Text style={s.trimestreLabel}>Trimestre:</Text>
              <View style={s.trimestreInsetBox}>
                {[1, 2, 3].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.trimestreBtn, trimestre === t && s.trimestreBtnActive]}
                    onPress={() => setTrimestre(t)}
                  >
                    <Text style={[s.trimestreBtnText, trimestre === t && s.trimestreBtnTextActive]}>
                      {t}° Trim
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── SECCIÓN 2: ACCIONES DEL CURSO (Botones estilo web) ── */}
        <View style={s.accionesCard}>
          <View style={s.accionesHeader}>
            <Ionicons name="flash" size={15} color={COLORS.accent} />
            <Text style={s.accionesTitle}>ACCIONES DEL CURSO</Text>
          </View>

          {/* Botón principal Pasar Asistencia */}
          <TouchableOpacity
            style={s.btnPasarAsistencia}
            onPress={() => setActiveTab('asistencia')}
            activeOpacity={0.88}
          >
            <View style={s.btnPasarAsistenciaLeft}>
              <View style={s.asistenciaIconBox}>
                <Ionicons name="checkmark-done" size={18} color="#fff" />
              </View>
              <Text style={s.btnPasarAsistenciaText}>PASAR ASISTENCIA</Text>
            </View>

            {estadoAsistenciaHoy === 'cargadas' && (
              <View style={s.badgeCargadas}>
                <View style={s.dotCargadas} />
                <Text style={s.textCargadas}>CARGADAS</Text>
              </View>
            )}
            {estadoAsistenciaHoy === 'pendiente' && (
              <View style={s.badgePendiente}>
                <View style={s.dotPendiente} />
                <Text style={s.textPendiente}>PENDIENTE</Text>
              </View>
            )}
            {estadoAsistenciaHoy === 'sin_clases' && (
              <View style={s.badgeSinClases}>
                <Text style={s.textSinClases}>SIN CLASES HOY</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Fila 2 en mobile: Concepto & Importar */}
          <View style={s.accionesFila2}>
            <TouchableOpacity
              style={[s.accionTile, { borderColor: '#fde68a' }]}
              onPress={() => setConceptoModalAbierto(true)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>😊</Text>
              <Text style={[s.accionTileText, { color: '#b45309' }]}>CONCEPTO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.accionTile, { borderColor: '#a7f3d0' }]}
              onPress={() => setImportarModalAbierto(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload" size={18} color="#059669" />
              <Text style={[s.accionTileText, { color: '#059669' }]}>IMPORTAR</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 3 en mobile: Nuevo Alumno & Ver Planillas */}
          <View style={s.accionesFila2}>
            <TouchableOpacity
              style={s.accionTile}
              onPress={() => {
                setEditandoAlumnoId(null);
                setNombre('');
                setApellido('');
                setDni('');
                setContacto('');
                setModalAlumno(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={17} color={COLORS.accent} />
              <Text style={s.accionTileText}>NUEVO ALUMNO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.accionTile}
              onPress={() => setActiveTab('planilla')}
              activeOpacity={0.8}
            >
              <Ionicons name="grid" size={17} color={COLORS.accent} />
              <Text style={s.accionTileText}>VER PLANILLAS</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 4: Botón Descargas / Exportación */}
          <TouchableOpacity
            style={s.descargasBtn}
            onPress={() => setMenuDescargasAbierto(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="download-outline" size={16} color={COLORS.accent} />
              <Text style={s.descargasBtnText}>DESCARGAS Y EXPORTACIÓN</Text>
            </View>
            <Ionicons name="chevron-down" size={15} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {/* ── SECCIÓN 3: HERO SECTION: DESTACADOS DEL CURSO (Fiel al web) ── */}
        {!busqueda.trim() && inscripciones.length > 0 && (
          <View style={s.heroSection}>
            <View style={s.heroHeader}>
              <View style={s.heroIconBox}>
                <Ionicons name="ribbon" size={18} color="#d97706" />
              </View>
              <View>
                <Text style={s.heroTitle}>DESTACADOS DEL CURSO</Text>
                <Text style={s.heroSub}>Top Asistencias y Mejores Calificaciones</Text>
              </View>
            </View>

            <View style={s.destacadosRow}>
              {/* Card Top Asistencia */}
              {destacados.topAsistencia && (
                <View style={s.destacadoCardEmerald}>
                  <View style={s.destacadoTop}>
                    <Text style={s.destacadoNombre} numberOfLines={1}>
                      {destacados.topAsistencia.insc.alumno?.apellido}, {destacados.topAsistencia.insc.alumno?.nombre}
                    </Text>
                    <View style={s.badgeTopAsist}>
                      <Ionicons name="calendar" size={10} color="#065f46" />
                      <Text style={s.badgeTopAsistText}>Top Asistencia</Text>
                    </View>
                  </View>

                  <View style={s.destacadoStatsBoxEmerald}>
                    <View style={s.destacadoStatItem}>
                      <Text style={s.destacadoStatLabel}>Nota {trimestre}° Trim</Text>
                      <Text style={s.destacadoStatValEmerald}>
                        {destacados.topAsistencia.stats.promedioTrim || '-'}
                      </Text>
                    </View>
                    <View style={[s.destacadoStatItem, s.destacadoStatDividerEmerald]}>
                      <Text style={s.destacadoStatLabel}>Asistencia</Text>
                      <Text style={[s.destacadoStatValEmerald, { color: '#059669' }]}>
                        {destacados.topAsistencia.stats.porcentaje}%
                      </Text>
                    </View>
                    <View style={s.destacadoStatItem}>
                      <Text style={s.destacadoStatLabel}>Prom. Total</Text>
                      <Text style={s.destacadoStatValEmerald}>
                        {destacados.topAsistencia.stats.promedio || '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Card Top Notas */}
              {destacados.topNota && (
                <View style={s.destacadoCardViolet}>
                  <View style={s.destacadoTop}>
                    <Text style={s.destacadoNombre} numberOfLines={1}>
                      {destacados.topNota.insc.alumno?.apellido}, {destacados.topNota.insc.alumno?.nombre}
                    </Text>
                    <View style={s.badgeTopNotas}>
                      <Ionicons name="star" size={10} color="#5b21b6" />
                      <Text style={s.badgeTopNotasText}>Mejor Nota</Text>
                    </View>
                  </View>

                  <View style={s.destacadoStatsBoxViolet}>
                    <View style={s.destacadoStatItem}>
                      <Text style={s.destacadoStatLabel}>Nota {trimestre}° Trim</Text>
                      <Text style={s.destacadoStatValViolet}>
                        {destacados.topNota.stats.promedioTrim || '-'}
                      </Text>
                    </View>
                    <View style={[s.destacadoStatItem, s.destacadoStatDividerViolet]}>
                      <Text style={s.destacadoStatLabel}>Asistencia</Text>
                      <Text style={s.destacadoStatValViolet}>
                        {destacados.topNota.stats.porcentaje ? `${destacados.topNota.stats.porcentaje}%` : '-'}
                      </Text>
                    </View>
                    <View style={s.destacadoStatItem}>
                      <Text style={s.destacadoStatLabel}>Prom. Total</Text>
                      <Text style={[s.destacadoStatValViolet, { color: COLORS.accent }]}>
                        {destacados.topNota.stats.promedio}/10
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── SECCIÓN 4: PESTAÑAS SUB-MENÚ (Alumnos, Asistencia, Notas, Planilla) ── */}
        <View style={s.tabsBar}>
          <TouchableOpacity
            style={[s.tabButton, activeTab === 'alumnos' && s.tabButtonActive]}
            onPress={() => setActiveTab('alumnos')}
          >
            <Ionicons name="people" size={16} color={activeTab === 'alumnos' ? COLORS.accent : COLORS.secondary} />
            <Text style={[s.tabButtonText, activeTab === 'alumnos' && s.tabButtonTextActive]}>
              Alumnos ({inscripciones.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabButton, activeTab === 'asistencia' && s.tabButtonActive]}
            onPress={() => setActiveTab('asistencia')}
          >
            <Ionicons name="checkbox" size={16} color={activeTab === 'asistencia' ? COLORS.accent : COLORS.secondary} />
            <Text style={[s.tabButtonText, activeTab === 'asistencia' && s.tabButtonTextActive]}>
              Asistencia
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabButton, activeTab === 'calificaciones' && s.tabButtonActive]}
            onPress={() => setActiveTab('calificaciones')}
          >
            <Ionicons name="school" size={16} color={activeTab === 'calificaciones' ? COLORS.accent : COLORS.secondary} />
            <Text style={[s.tabButtonText, activeTab === 'calificaciones' && s.tabButtonTextActive]}>
              Notas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabButton, activeTab === 'planilla' && s.tabButtonActive]}
            onPress={() => setActiveTab('planilla')}
          >
            <Ionicons name="grid" size={16} color={activeTab === 'planilla' ? COLORS.accent : COLORS.secondary} />
            <Text style={[s.tabButtonText, activeTab === 'planilla' && s.tabButtonTextActive]}>
              Planilla
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── CONTENIDO: TAB 1 ALUMNOS ── */}
        {activeTab === 'alumnos' && (
          <View style={s.tabSection}>
            {/* Buscador Neumorphic Inset */}
            <View style={s.searchWrap}>
              <Ionicons name="search" size={18} color={COLORS.secondary} />
              <TextInput
                style={s.searchField}
                placeholder="Buscar por nombre, apellido o DNI..."
                placeholderTextColor={COLORS.secondary}
                value={busqueda}
                onChangeText={setBusqueda}
              />
              {busqueda ? (
                <TouchableOpacity onPress={() => setBusqueda('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Chips de ordenamiento rápido */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortScroll}>
              <Text style={s.sortPrefix}>Ordenar:</Text>
              {(
                [
                  { key: 'alfabetico-asc', label: 'A → Z' },
                  { key: 'alfabetico-desc', label: 'Z → A' },
                  { key: 'asistencia', label: 'Mayor Asistencia %' },
                  { key: 'calificaciones', label: 'Mejores Notas' },
                ] as const
              ).map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[s.sortChip, criterioOrden === o.key && s.sortChipActive]}
                  onPress={() => setCriterioOrden(o.key)}
                >
                  <Text style={[s.sortChipText, criterioOrden === o.key && s.sortChipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Listado de tarjetas de alumnos */}
            {alumnosProcesados.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="people-outline" size={44} color={COLORS.secondary} />
                <Text style={s.emptyTitle}>
                  {busqueda ? `No se encontraron resultados para "${busqueda}"` : 'No hay alumnos inscriptos aún'}
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => {
                    setEditandoAlumnoId(null);
                    setNombre('');
                    setApellido('');
                    setDni('');
                    setContacto('');
                    setModalAlumno(true);
                  }}
                >
                  <Text style={s.emptyBtnText}>+ Inscribir Primer Alumno</Text>
                </TouchableOpacity>
              </View>
            ) : (
              alumnosProcesados.map((insc) => {
                const stats = getStatsAlumno(insc.id);
                const iniciales = `${(insc.alumno?.nombre || '')[0] || ''}${(insc.alumno?.apellido || '')[0] || ''}`.toUpperCase();

                return (
                  <View key={insc.id} style={s.alumnoCard}>
                    <View style={s.alumnoCardTop}>
                      {/* Avatar neumorphic inset */}
                      <View style={s.alumnoAvatarBox}>
                        <Text style={s.alumnoAvatarText}>{iniciales}</Text>
                      </View>

                      {/* Datos del alumno */}
                      <View style={s.alumnoDatosCol}>
                        <Text style={s.alumnoNombre} numberOfLines={1}>
                          {insc.alumno?.apellido}, {insc.alumno?.nombre}
                        </Text>
                        {insc.alumno?.contacto ? (
                          <View style={s.contactoRow}>
                            <Ionicons name="call" size={11} color={COLORS.secondary} />
                            <Text style={s.contactoText} numberOfLines={1}>
                              {insc.alumno.contacto}
                            </Text>
                          </View>
                        ) : (
                          <Text style={s.sinContactoText}>Sin teléfono</Text>
                        )}
                      </View>

                      {/* Acciones Editar & Eliminar */}
                      <View style={s.alumnoActionsRow}>
                        <TouchableOpacity
                          style={s.iconActionBtn}
                          onPress={() => handleEditarAlumno(insc.alumno)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="create-outline" size={17} color={COLORS.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.iconActionBtn}
                          onPress={() =>
                            handleEliminarAlumno(insc.id, `${insc.alumno?.apellido} ${insc.alumno?.nombre}`)
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={17} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Barra de métricas y botón Perfil */}
                    <View style={s.alumnoCardBottom}>
                      <View style={s.metricsRow}>
                        <Text style={s.metricLabel}>
                          Asistencia: <Text style={s.metricVal}>{stats.porcentaje !== null ? `${stats.porcentaje}%` : '-'}</Text>
                        </Text>
                        <Text style={s.metricLabel}>
                          Promedio: <Text style={s.metricVal}>{stats.promedio ? `${stats.promedio}/10` : '-'}</Text>
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={s.perfilBtn}
                        onPress={() => setPerfilAlumno({ insc, stats })}
                        activeOpacity={0.8}
                      >
                        <Text style={s.perfilBtnText}>Perfil</Text>
                        <Ionicons name="arrow-forward" size={11} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── CONTENIDO: TAB 2 ASISTENCIA ── */}
        {activeTab === 'asistencia' && (
          <View style={s.tabSection}>
            <View style={s.asistenciaHeaderCard}>
              <View style={s.asistenciaDateRow}>
                <Ionicons name="today-outline" size={18} color={COLORS.accent} />
                <Text style={s.asistenciaDateText}>Fecha: {fechaAsistencia}</Text>
              </View>

              <TouchableOpacity
                style={s.todosPresentesBtn}
                onPress={() => {
                  const m: Record<number, string> = {};
                  inscripciones.forEach((i) => { m[i.id] = 'presente'; });
                  setAsistenciasHoy(m);
                }}
              >
                <Ionicons name="checkmark-done" size={14} color={COLORS.accent} />
                <Text style={s.todosPresentesText}>Todos Presentes</Text>
              </TouchableOpacity>
            </View>

            {inscripciones.map((insc) => {
              const estado = asistenciasHoy[insc.id] || 'presente';
              return (
                <View key={insc.id} style={s.asistenciaRowCard}>
                  <Text style={s.asistenciaNombre} numberOfLines={1}>
                    {insc.alumno?.apellido}, {insc.alumno?.nombre}
                  </Text>
                  <View style={s.asistenciaPillsGroup}>
                    {ESTADOS_ASISTENCIA.map((est) => {
                      const sel = estado === est.key;
                      return (
                        <TouchableOpacity
                          key={est.key}
                          style={[
                            s.asistenciaPill,
                            sel && { backgroundColor: est.color, borderColor: est.color },
                          ]}
                          onPress={() => setAsistenciasHoy((p) => ({ ...p, [insc.id]: est.key }))}
                        >
                          <Text style={[s.asistenciaPillText, sel && { color: '#fff', fontWeight: '800' }]}>
                            {est.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={s.guardarAsistenciaBigBtn}
              onPress={handleGuardarAsistencia}
              disabled={guardandoAsistencia}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={s.guardarAsistenciaBigText}>
                {guardandoAsistencia ? 'Guardando...' : 'Guardar Asistencias'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CONTENIDO: TAB 3 CALIFICACIONES ── */}
        {activeTab === 'calificaciones' && (
          <View style={s.tabSection}>
            <View style={s.notasHeaderRow}>
              <Text style={s.notasHeaderTitle}>NOTAS {trimestre}° TRIMESTRE</Text>
              <TouchableOpacity
                style={s.cargarNotaHeaderBtn}
                onPress={() => {
                  if (inscripciones.length > 0) setAlumnoSeleccionadoId(inscripciones[0].id);
                  setModalNuevaNota(true);
                }}
              >
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={s.cargarNotaHeaderText}>+ Cargar Nota</Text>
              </TouchableOpacity>
            </View>

            {inscripciones.map((insc) => {
              const notasTrim = calificaciones.filter(
                (c) => c.alumnoCursoId === insc.id && Number(c.trimestre) === trimestre
              );
              const suma = notasTrim.reduce((acc, n) => acc + Number(n.valor), 0);
              const prom = notasTrim.length > 0 ? (suma / notasTrim.length).toFixed(1) : '-';

              return (
                <View key={insc.id} style={s.calificacionCard}>
                  <View style={s.calificacionTop}>
                    <Text style={s.calificacionNombre}>
                      {insc.alumno?.apellido}, {insc.alumno?.nombre}
                    </Text>
                    <View style={s.calificacionPromBadge}>
                      <Text style={s.promLabel}>Prom:</Text>
                      <Text style={s.promValue}>{prom}</Text>
                    </View>
                  </View>

                  <View style={s.notasListWrap}>
                    {notasTrim.length === 0 ? (
                      <Text style={s.sinNotasLabel}>Sin notas registradas en este trimestre.</Text>
                    ) : (
                      notasTrim.map((nota) => (
                        <View key={nota.id} style={s.notaBadge}>
                          <Text style={s.notaTipoLabel}>{nota.tipo.slice(0, 4)}</Text>
                          <Text style={s.notaValorText}>{nota.valor}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── CONTENIDO: TAB 4 PLANILLA ── */}
        {activeTab === 'planilla' && (
          <View style={s.tabSection}>
            <View style={s.planillaHeader}>
              <Text style={s.planillaHeaderTitle}>RESUMEN GENERAL DEL CURSO</Text>
              <Text style={s.planillaHeaderSub}>{inscripciones.length} Alumnos en total</Text>
            </View>

            {inscripciones.map((insc, idx) => {
              const stats = getStatsAlumno(insc.id);
              return (
                <View key={insc.id} style={s.planillaRowCard}>
                  <View style={s.planillaOrderBox}>
                    <Text style={s.planillaOrderText}>{idx + 1}</Text>
                  </View>
                  <View style={s.planillaInfo}>
                    <Text style={s.planillaNombre}>
                      {insc.alumno?.apellido}, {insc.alumno?.nombre}
                    </Text>
                    <View style={s.planillaCols}>
                      <View style={s.planillaCol}>
                        <Text style={s.pColLabel}>Asistencia</Text>
                        <Text style={s.pColVal}>{stats.porcentaje !== null ? `${stats.porcentaje}%` : '-'}</Text>
                        <Text style={s.pColSub}>{stats.presentes}/{stats.total} clases</Text>
                      </View>
                      <View style={s.planillaCol}>
                        <Text style={s.pColLabel}>Promedio</Text>
                        <Text style={[s.pColVal, { color: COLORS.accent }]}>
                          {stats.promedio ? `${stats.promedio}/10` : '-'}
                        </Text>
                        <Text style={s.pColSub}>{stats.notas.length} notas</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── MODAL PERFIL DETALLADO DE ALUMNO (Fiel al web PerfilAlumnoModal) ── */}
      <Modal visible={!!perfilAlumno} transparent animationType="slide" onRequestClose={() => setPerfilAlumno(null)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>Perfil del Alumno</Text>
              <TouchableOpacity onPress={() => setPerfilAlumno(null)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {perfilAlumno && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.perfilAvatarBig}>
                  <Text style={s.perfilAvatarBigText}>
                    {`${(perfilAlumno.insc.alumno?.nombre || '')[0] || ''}${(perfilAlumno.insc.alumno?.apellido || '')[0] || ''}`.toUpperCase()}
                  </Text>
                </View>

                <Text style={s.perfilNombreModal}>
                  {perfilAlumno.insc.alumno?.apellido}, {perfilAlumno.insc.alumno?.nombre}
                </Text>

                {perfilAlumno.insc.alumno?.dni ? (
                  <Text style={s.perfilDniModal}>DNI: {perfilAlumno.insc.alumno.dni}</Text>
                ) : null}

                {perfilAlumno.insc.alumno?.contacto ? (
                  <Text style={s.perfilContactoModal}>📞 {perfilAlumno.insc.alumno.contacto}</Text>
                ) : null}

                {/* Métricas destacadas */}
                <View style={s.perfilMetricsGrid}>
                  <View style={s.perfilMetricBox}>
                    <Text style={s.perfilMetricLabel}>Asistencia General</Text>
                    <Text style={[s.perfilMetricVal, { color: '#059669' }]}>
                      {perfilAlumno.stats.porcentaje !== null ? `${perfilAlumno.stats.porcentaje}%` : 'S/D'}
                    </Text>
                    <Text style={s.perfilMetricSub}>
                      {perfilAlumno.stats.presentes} de {perfilAlumno.stats.total} clases
                    </Text>
                  </View>

                  <View style={s.perfilMetricBox}>
                    <Text style={s.perfilMetricLabel}>Promedio General</Text>
                    <Text style={[s.perfilMetricVal, { color: COLORS.accent }]}>
                      {perfilAlumno.stats.promedio ? `${perfilAlumno.stats.promedio}/10` : 'S/D'}
                    </Text>
                    <Text style={s.perfilMetricSub}>{perfilAlumno.stats.notas.length} notas cargadas</Text>
                  </View>
                </View>

                {/* Notas por Trimestre */}
                <Text style={s.perfilSubheading}>Calificaciones Registradas:</Text>
                {perfilAlumno.stats.notas.length === 0 ? (
                  <Text style={s.perfilEmptyText}>No hay notas cargadas para este alumno.</Text>
                ) : (
                  perfilAlumno.stats.notas.map((n: Calificacion) => (
                    <View key={n.id} style={s.perfilNotaItem}>
                      <View>
                        <Text style={s.perfilNotaTipo}>{n.tipo}</Text>
                        <Text style={s.perfilNotaFecha}>{n.trimestre}° Trimestre · {n.fecha.split('T')[0]}</Text>
                      </View>
                      <Text style={s.perfilNotaValor}>{n.valor}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View style={{ marginTop: SPACING.md }}>
              <AppButton label="Cerrar" variant="outline" onPress={() => setPerfilAlumno(null)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL NUEVO / EDITAR ALUMNO ── */}
      <Modal visible={modalAlumno} transparent animationType="slide" onRequestClose={() => setModalAlumno(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>{editandoAlumnoId ? 'Editar Alumno' : '+ Inscribir Nuevo Alumno'}</Text>
              <TouchableOpacity onPress={() => setModalAlumno(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <AppInput label="Apellido *" value={apellido} onChangeText={setApellido} placeholder="Ej: Gómez" />
            <AppInput label="Nombre *" value={nombre} onChangeText={setNombre} placeholder="Ej: Lucas Matías" />
            <AppInput label="DNI (opcional)" value={dni} onChangeText={setDni} placeholder="Ej: 46123456" keyboardType="numeric" />
            <AppInput label="Contacto / Teléfono (opcional)" value={contacto} onChangeText={setContacto} placeholder="Ej: 11-4567-8901" keyboardType="phone-pad" />

            <View style={m.actions}>
              <AppButton label="Cancelar" variant="outline" onPress={() => setModalAlumno(false)} style={{ flex: 1 }} />
              <AppButton
                label={guardandoAlumno ? 'Guardando...' : editandoAlumnoId ? 'Guardar Cambios' : 'Inscribir'}
                onPress={handleGuardarAlumno}
                loading={guardandoAlumno}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CARGAR NOTA ── */}
      <Modal visible={modalNuevaNota} transparent animationType="slide" onRequestClose={() => setModalNuevaNota(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <Text style={m.title}>+ Cargar Calificación</Text>
              <TouchableOpacity onPress={() => setModalNuevaNota(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabelModal}>Alumno:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScrollModal}>
              {inscripciones.map((insc) => (
                <TouchableOpacity
                  key={insc.id}
                  style={[s.modalChip, alumnoSeleccionadoId === insc.id && s.modalChipActive]}
                  onPress={() => setAlumnoSeleccionadoId(insc.id)}
                >
                  <Text style={[s.modalChipText, alumnoSeleccionadoId === insc.id && s.modalChipTextActive]}>
                    {insc.alumno?.apellido} {insc.alumno?.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[s.inputLabelModal, { marginTop: 10 }]}>Tipo de Evaluación:</Text>
            <View style={s.tipoNotaRow}>
              {['Evaluación', 'Trabajo Práctico', 'Oral', 'Concepto'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.modalTipoChip, tipoNota === t && s.modalTipoChipActive]}
                  onPress={() => setTipoNota(t)}
                >
                  <Text style={[s.modalTipoChipText, tipoNota === t && s.modalTipoChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <AppInput
              label="Calificación (1 a 10) *"
              value={valorNota}
              onChangeText={setValorNota}
              placeholder="Ej: 8.50"
              keyboardType="numeric"
            />

            <View style={m.actions}>
              <AppButton label="Cancelar" variant="outline" onPress={() => setModalNuevaNota(false)} style={{ flex: 1 }} />
              <AppButton label={guardandoNota ? 'Guardando...' : 'Guardar Nota'} onPress={handleGuardarNota} loading={guardandoNota} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL IMPORTAR ALUMNOS DESDE LISTA / TEXTO / EXCEL ── */}
      <ImportarAlumnosModal
        abierto={importarModalAbierto}
        cursoId={cursoId}
        onCerrar={() => setImportarModalAbierto(false)}
        onImportados={cargarDatos}
      />

      {/* ── MODAL EVALUAR CONCEPTO DIARIO (CARITAS) ── */}
      <PasoConceptoModal
        abierto={conceptoModalAbierto}
        inscripciones={inscripciones}
        trimestre={trimestre}
        onCerrar={() => setConceptoModalAbierto(false)}
        onFinalizado={cargarDatos}
      />

      {/* ── MODAL DESCARGAS Y EXPORTACIÓN (Fiel al web) ── */}
      <Modal visible={menuDescargasAbierto} transparent animationType="slide" onRequestClose={() => setMenuDescargasAbierto(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.head}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.descargaModalIcon}>
                  <Ionicons name="download" size={18} color={COLORS.accent} />
                </View>
                <Text style={m.title}>Descargas y Exportación</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuDescargasAbierto(false)}>
                <Ionicons name="close" size={22} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.descargasModalSub}>Elegí el formato o informe para compartir / guardar:</Text>

            {/* Opción 1: Excel Asistencias */}
            <TouchableOpacity
              style={s.opcionDescargaCard}
              onPress={() => {
                setMenuDescargasAbierto(false);
                exportarAsistenciasCsv(
                  { materia: curso?.materia || '', anio: curso?.anio || '', escuela: curso?.escuela || '' },
                  inscripciones,
                  asistencias
                );
              }}
              activeOpacity={0.8}
            >
              <View style={[s.opcionIconBox, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="document-text" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.opcionTitulo}>Excel / CSV de Asistencias</Text>
                <Text style={s.opcionSub}>Registro diario y porcentajes de asistencia</Text>
              </View>
              <Ionicons name="share-outline" size={18} color={COLORS.accent} />
            </TouchableOpacity>

            {/* Opción 2: Excel Calificaciones */}
            <TouchableOpacity
              style={s.opcionDescargaCard}
              onPress={() => {
                setMenuDescargasAbierto(false);
                exportarCalificacionesCsv(
                  { materia: curso?.materia || '', anio: curso?.anio || '', escuela: curso?.escuela || '' },
                  inscripciones,
                  calificaciones
                );
              }}
              activeOpacity={0.8}
            >
              <View style={[s.opcionIconBox, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="school" size={20} color="#6d28d9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.opcionTitulo}>Excel / CSV de Calificaciones</Text>
                <Text style={s.opcionSub}>Planilla con notas por trimestre y promedios</Text>
              </View>
              <Ionicons name="share-outline" size={18} color={COLORS.accent} />
            </TouchableOpacity>

            {/* Opción 3: Informe Pedagógico */}
            <TouchableOpacity
              style={s.opcionDescargaCard}
              onPress={() => {
                setMenuDescargasAbierto(false);
                exportarInformePedagogico(
                  { materia: curso?.materia || '', anio: curso?.anio || '', escuela: curso?.escuela || '' },
                  inscripciones,
                  asistencias,
                  calificaciones
                );
              }}
              activeOpacity={0.8}
            >
              <View style={[s.opcionIconBox, { backgroundColor: '#ffe4e6' }]}>
                <Ionicons name="newspaper" size={20} color="#e11d48" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.opcionTitulo}>Informe Pedagógico Completo</Text>
                <Text style={s.opcionSub}>Boletín listo para compartir o imprimir</Text>
              </View>
              <Ionicons name="share-outline" size={18} color={COLORS.accent} />
            </TouchableOpacity>

            {/* Opción 4: Planilla Trimestral */}
            <TouchableOpacity
              style={s.opcionDescargaCard}
              onPress={() => {
                setMenuDescargasAbierto(false);
                setActiveTab('planilla');
              }}
              activeOpacity={0.8}
            >
              <View style={[s.opcionIconBox, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="grid" size={20} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.opcionTitulo}>Ver Planilla en Pantalla</Text>
                <Text style={s.opcionSub}>Cuadro interactivo de todo el curso</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },

  // Top Nav Bar
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

  // Scroll
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.lg },

  // 1. Header Neumorphic
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    gap: SPACING.md,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitleCol: { flex: 1, gap: 4 },
  mainSectionTitle: { fontSize: 26, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.5 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  headerAnioBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerAnioText: { fontSize: 10, fontWeight: '800', color: '#5b21b6', textTransform: 'uppercase' },
  headerMateriaText: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface },
  headerEscuelaText: { fontSize: 12, color: COLORS.secondary, fontWeight: '500' },
  headerDivider: { height: 1, backgroundColor: 'rgba(124,58,237,0.08)' },
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  anioEscolarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  anioEscolarText: { fontSize: 11, color: COLORS.secondary, fontWeight: '500' },
  enCursoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  enCursoText: { fontSize: 10, fontWeight: '700', color: COLORS.accent },

  trimestreGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trimestreLabel: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  trimestreInsetBox: {
    flexDirection: 'row',
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    padding: 2,
    gap: 2,
  },
  trimestreBtn: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
  trimestreBtnActive: { backgroundColor: COLORS.accent },
  trimestreBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.accent },
  trimestreBtnTextActive: { color: '#fff' },

  // 2. Acciones del Curso
  accionesCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  accionesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accionesTitle: { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6 },
  btnPasarAsistencia: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPasarAsistenciaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  asistenciaIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPasarAsistenciaText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  badgeCargadas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  dotCargadas: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  textCargadas: { fontSize: 9, fontWeight: '800', color: '#fff' },
  badgePendiente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  dotPendiente: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fbbf24' },
  textPendiente: { fontSize: 9, fontWeight: '800', color: '#fff' },
  badgeSinClases: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  textSinClases: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  accionesFila2: { flexDirection: 'row', gap: 6 },
  accionTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  accionTileText: { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.2 },

  descargasBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    paddingVertical: 11,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  descargasBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.5 },

  // Descargas Modal Sheet
  descargaModalIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  descargasModalSub: { fontSize: 12, color: COLORS.secondary, marginBottom: 8 },
  opcionDescargaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  opcionIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface },
  opcionSub: { fontSize: 10, color: COLORS.secondary, marginTop: 1 },

  // 3. Hero Section Destacados
  heroSection: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    gap: SPACING.sm,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  heroIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 12, fontWeight: '800', color: '#1e1b4b', letterSpacing: 0.3 },
  heroSub: { fontSize: 10, color: COLORS.secondary },
  destacadosRow: { gap: SPACING.sm },
  destacadoCardEmerald: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 8,
  },
  destacadoCardViolet: {
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    gap: 8,
  },
  destacadoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  destacadoNombre: { fontSize: 13, fontWeight: '800', color: '#1e1b4b', flex: 1 },
  badgeTopAsist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTopAsistText: { fontSize: 9, fontWeight: '800', color: '#166534' },
  badgeTopNotas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTopNotasText: { fontSize: 9, fontWeight: '800', color: '#5b21b6' },
  destacadoStatsBoxEmerald: {
    flexDirection: 'row',
    backgroundColor: '#dcfce7',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  destacadoStatsBoxViolet: {
    flexDirection: 'row',
    backgroundColor: '#ede9fe',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  destacadoStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  destacadoStatDividerEmerald: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#bbf7d0' },
  destacadoStatDividerViolet: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#ddd6fe' },
  destacadoStatLabel: { fontSize: 9, fontWeight: '700', color: COLORS.secondary, textTransform: 'uppercase' },
  destacadoStatValEmerald: { fontSize: 13, fontWeight: '800', color: '#065f46' },
  destacadoStatValViolet: { fontSize: 13, fontWeight: '800', color: '#4c1d95' },

  // 4. Tabs Bar
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  tabButtonActive: { backgroundColor: '#ede9fe' },
  tabButtonText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  tabButtonTextActive: { color: COLORS.accent, fontWeight: '800' },

  // Tabs Content
  tabSection: { gap: SPACING.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  searchField: { flex: 1, fontSize: 12, color: COLORS.onSurface },
  sortScroll: { maxHeight: 34, marginVertical: 2 },
  sortPrefix: { fontSize: 10, fontWeight: '800', color: COLORS.secondary, alignSelf: 'center', marginRight: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
    marginRight: 6,
  },
  sortChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sortChipText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  sortChipTextActive: { color: '#fff' },

  // Tarjetas de alumnos
  alumnoCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 10,
  },
  alumnoCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alumnoAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alumnoAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.accent },
  alumnoDatosCol: { flex: 1, gap: 2 },
  alumnoNombre: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface },
  contactoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactoText: { fontSize: 11, color: COLORS.secondary, fontWeight: '500' },
  sinContactoText: { fontSize: 10, color: '#9ca3af', fontStyle: 'italic' },
  alumnoActionsRow: { flexDirection: 'row', gap: 4 },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alumnoCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: 8,
  },
  metricsRow: { flexDirection: 'row', gap: SPACING.md },
  metricLabel: { fontSize: 11, fontWeight: '600', color: COLORS.secondary },
  metricVal: { fontWeight: '800', color: COLORS.accent },
  perfilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  perfilBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.accent, textTransform: 'uppercase' },

  // Asistencia Tab
  asistenciaHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  asistenciaDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  asistenciaDateText: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface },
  todosPresentesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  todosPresentesText: { fontSize: 10, fontWeight: '800', color: COLORS.accent },
  asistenciaRowCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  asistenciaNombre: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  asistenciaPillsGroup: { flexDirection: 'row', gap: 5 },
  asistenciaPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  asistenciaPillText: { fontSize: 9, fontWeight: '600', color: '#4b5563' },
  guardarAsistenciaBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.xl,
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  guardarAsistenciaBigText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Calificaciones Tab
  notasHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notasHeaderTitle: { fontSize: 11, fontWeight: '800', color: COLORS.secondary, letterSpacing: 0.5 },
  cargarNotaHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  cargarNotaHeaderText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  calificacionCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
    gap: 6,
  },
  calificacionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calificacionNombre: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface, flex: 1 },
  calificacionPromBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promLabel: { fontSize: 9, fontWeight: '700', color: COLORS.secondary },
  promValue: { fontSize: 12, fontWeight: '800', color: COLORS.accent },
  notasListWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sinNotasLabel: { fontSize: 10, color: COLORS.secondary, fontStyle: 'italic' },
  notaBadge: {
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  notaTipoLabel: { fontSize: 8, fontWeight: '700', color: '#5b21b6', textTransform: 'uppercase' },
  notaValorText: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface },

  // Planilla Tab
  planillaHeader: { gap: 2 },
  planillaHeaderTitle: { fontSize: 11, fontWeight: '800', color: COLORS.secondary, letterSpacing: 0.5 },
  planillaHeaderSub: { fontSize: 10, color: COLORS.secondary },
  planillaRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
    gap: 10,
  },
  planillaOrderBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planillaOrderText: { fontSize: 11, fontWeight: '800', color: COLORS.accent },
  planillaInfo: { flex: 1, gap: 4 },
  planillaNombre: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface },
  planillaCols: { flexDirection: 'row', gap: SPACING.lg },
  planillaCol: { gap: 1 },
  pColLabel: { fontSize: 9, color: COLORS.secondary, fontWeight: '600' },
  pColVal: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface },
  pColSub: { fontSize: 8, color: COLORS.secondary },

  // Empty Card
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, textAlign: 'center' },
  emptyBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Modal Perfil Detallado
  perfilAvatarBig: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  perfilAvatarBigText: { fontSize: 24, fontWeight: '800', color: COLORS.accent },
  perfilNombreModal: { fontSize: 17, fontWeight: '800', color: COLORS.onSurface, textAlign: 'center' },
  perfilDniModal: { fontSize: 11, color: COLORS.secondary, textAlign: 'center', marginTop: 2 },
  perfilContactoModal: { fontSize: 11, color: COLORS.accent, textAlign: 'center', marginTop: 2, fontWeight: '700' },
  perfilMetricsGrid: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  perfilMetricBox: {
    flex: 1,
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 2,
  },
  perfilMetricLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, textAlign: 'center' },
  perfilMetricVal: { fontSize: 18, fontWeight: '800' },
  perfilMetricSub: { fontSize: 9, color: COLORS.secondary, textAlign: 'center' },
  perfilSubheading: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface, marginTop: SPACING.md, marginBottom: 6 },
  perfilEmptyText: { fontSize: 11, color: COLORS.secondary, fontStyle: 'italic' },
  perfilNotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ede9fe',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 6,
  },
  perfilNotaTipo: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface },
  perfilNotaFecha: { fontSize: 10, color: COLORS.secondary },
  perfilNotaValor: { fontSize: 15, fontWeight: '800', color: COLORS.accent },

  // Inputs Modal
  inputLabelModal: { fontSize: 11, fontWeight: '800', color: COLORS.onSurface, marginBottom: 4 },
  chipScrollModal: { maxHeight: 38, marginBottom: 8 },
  modalChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
  },
  modalChipActive: { backgroundColor: COLORS.accent },
  modalChipText: { fontSize: 10, fontWeight: '600', color: COLORS.onSurface },
  modalChipTextActive: { color: '#fff', fontWeight: '700' },
  tipoNotaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  modalTipoChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
  },
  modalTipoChipActive: { backgroundColor: COLORS.accent },
  modalTipoChipText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  modalTipoChipTextActive: { color: '#fff' },
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
  title: { fontSize: 17, fontWeight: '800', color: COLORS.onSurface },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
