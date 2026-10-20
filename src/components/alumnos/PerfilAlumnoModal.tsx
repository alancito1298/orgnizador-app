import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text as RNText,
  type TextProps,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const Text = (props: TextProps) => <RNText allowFontScaling={false} {...props} />;
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING } from '../../theme';

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

interface Calificacion {
  id: number;
  alumnoCursoId: number;
  trimestre: number;
  tipo: string;
  valor: string | number;
  fecha?: string;
}

interface Asistencia {
  id: number;
  alumnoCursoId: number;
  fecha: string;
  estado: string;
  trimestre?: number;
}

interface Props {
  abierto: boolean;
  inscripcion: Inscripcion | null;
  cursoInfo?: {
    id?: number;
    materia?: string;
    anio?: string | number;
    escuela?: string;
  };
  asistenciasLocales?: Asistencia[];
  calificacionesLocales?: Calificacion[];
  onCerrar: () => void;
}

const formatearFecha = (fechaStr: string) => {
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr.split('T')[0] || fechaStr;
    const dia = d.getUTCDate().toString().padStart(2, '0');
    const mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${dia}/${mes}`;
  } catch {
    return fechaStr;
  }
};

const obtenerConfigConcepto = (estado: string) => {
  switch (estado) {
    case 'presente_buen_concepto':
    case 'buen_concepto':
      return {
        emoji: '😊',
        nombre: 'Excelente',
        color: '#16a34a',
        bg: '#dcfce7',
        border: '#86efac',
      };
    case 'regular':
    case 'presente_regular':
      return {
        emoji: '😐',
        nombre: 'Regular',
        color: '#d97706',
        bg: '#fef3c7',
        border: '#fde68a',
      };
    case 'presente_mal_concepto':
    case 'mal_concepto':
      return {
        emoji: '😞',
        nombre: 'A Mejorar',
        color: '#e11d48',
        bg: '#ffe4e6',
        border: '#fca5a5',
      };
    case 'ausente':
      return {
        emoji: '❌',
        nombre: 'Ausente',
        color: '#dc2626',
        bg: '#fee2e2',
        border: '#fca5a5',
      };
    case 'justificada':
      return {
        emoji: '🕐',
        nombre: 'Justificada',
        color: '#0891b2',
        bg: '#cffafe',
        border: '#67e8f9',
      };
    default:
      return {
        emoji: '✅',
        nombre: 'Presente',
        color: '#16a34a',
        bg: '#dcfce7',
        border: '#86efac',
      };
  }
};

export default function PerfilAlumnoModal({
  abierto,
  inscripcion,
  cursoInfo,
  asistenciasLocales = [],
  calificacionesLocales = [],
  onCerrar,
}: Props) {
  const [vista, setVista] = useState<'general' | 'calificaciones' | 'asistencias'>('general');
  const [filtroTrimestre, setFiltroTrimestre] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [perfilApi, setPerfilApi] = useState<any>(null);

  // Intentar cargar estadísticas calculadas por el backend cuando abre el modal
  useEffect(() => {
    if (!abierto || !inscripcion) {
      setPerfilApi(null);
      setVista('general');
      return;
    }

    let activo = true;
    const fetchPerfil = async () => {
      try {
        const data = await apiFetch(`/alumnos/perfil/${inscripcion.id}`, { auth: true });
        if (activo && data) {
          setPerfilApi(data);
        }
      } catch {
        // En offline o error de red, usamos el cálculo local sin bloquear
      }
    };

    fetchPerfil();
    return () => {
      activo = false;
    };
  }, [abierto, inscripcion]);

  // Cálculo local (fallback offline y tiempo real)
  const statsLocal = useMemo(() => {
    if (!inscripcion) return null;

    const asis = asistenciasLocales.filter((a) => a.alumnoCursoId === inscripcion.id);
    const notas = calificacionesLocales.filter((c) => c.alumnoCursoId === inscripcion.id);

    const buenConcepto = asis.filter((a) => a.estado === 'presente_buen_concepto' || a.estado === 'buen_concepto').length;
    const malConcepto = asis.filter((a) => a.estado === 'presente_mal_concepto' || a.estado === 'mal_concepto').length;
    const regular = asis.filter((a) => a.estado === 'regular' || a.estado === 'presente_regular').length;
    const presentesSimples = asis.filter((a) => a.estado === 'presente').length;
    const ausentes = asis.filter((a) => a.estado === 'ausente').length;
    const justificadas = asis.filter((a) => a.estado === 'justificada').length;

    const totalAsistencias = asis.length;
    const totalPresentes = buenConcepto + malConcepto + regular + presentesSimples;
    const porcentajeAsistencia = totalAsistencias > 0
      ? Math.round(((totalPresentes + justificadas) * 100) / totalAsistencias)
      : null;

    // Notas por trimestre
    const calcPromTrimestre = (trim: number) => {
      const notasTrim = notas.filter((n) => Number(n.trimestre) === trim && !isNaN(Number(n.valor)));
      if (notasTrim.length === 0) return null;
      const sum = notasTrim.reduce((acc, curr) => acc + Number(curr.valor), 0);
      return Number((sum / notasTrim.length).toFixed(1));
    };

    const promT1 = calcPromTrimestre(1);
    const promT2 = calcPromTrimestre(2);
    const promT3 = calcPromTrimestre(3);

    const notasValidas = notas.filter((n) => !isNaN(Number(n.valor)));
    const promGeneral = notasValidas.length > 0
      ? Number((notasValidas.reduce((acc, curr) => acc + Number(curr.valor), 0) / notasValidas.length).toFixed(1))
      : null;

    // Asistencias ordenadas de más recientes a antiguas
    const asistenciasOrdenadas = [...asis].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const notasOrdenadas = [...notas].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

    return {
      totalAsistencias,
      totalPresentes,
      porcentajeAsistencia,
      buenConcepto,
      malConcepto,
      regular,
      presentesSimples,
      ausentes,
      justificadas,
      promT1,
      promT2,
      promT3,
      promGeneral,
      asistenciasOrdenadas,
      notasOrdenadas,
      totalNotas: notas.length,
    };
  }, [inscripcion, asistenciasLocales, calificacionesLocales]);

  if (!abierto || !inscripcion) return null;

  const alum = inscripcion.alumno;
  const stats = statsLocal;

  // Promedios a mostrar (priorizando backend si existe, sino local)
  const promGeneral = perfilApi?.promedios?.general > 0 ? perfilApi.promedios.general : stats?.promGeneral;
  const promT1 = perfilApi?.promedios?.primerTrimestre > 0 ? perfilApi.promedios.primerTrimestre : stats?.promT1;
  const promT2 = perfilApi?.promedios?.segundoTrimestre > 0 ? perfilApi.promedios.segundoTrimestre : stats?.promT2;
  const promT3 = perfilApi?.promedios?.tercerTrimestre > 0 ? perfilApi.promedios.tercerTrimestre : stats?.promT3;

  const pctAsistencia = perfilApi?.estadisticas?.porcentajeAsistencia ?? stats?.porcentajeAsistencia;
  const totalClases = perfilApi?.estadisticas?.totalAsistencias ?? stats?.totalAsistencias ?? 0;
  const totalPresentes = perfilApi?.estadisticas?.totalPresentes ?? stats?.totalPresentes ?? 0;
  const totalAusentes = perfilApi?.estadisticas?.ausentes ?? stats?.ausentes ?? 0;
  const totalJustificadas = perfilApi?.estadisticas?.justificadas ?? stats?.justificadas ?? 0;
  const totalBuenConcepto = perfilApi?.estadisticas?.presentesBuenConcepto ?? stats?.buenConcepto ?? 0;
  const totalMalConcepto = perfilApi?.estadisticas?.presentesMalConcepto ?? stats?.malConcepto ?? 0;

  const asistenciasOrdenadas = (perfilApi?.asistencias && perfilApi.asistencias.length > 0)
    ? [...perfilApi.asistencias].sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    : (stats?.asistenciasOrdenadas || []);

  const notasOrdenadas = (perfilApi?.notas && perfilApi.notas.length > 0)
    ? [...perfilApi.notas].sort((a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
    : (stats?.notasOrdenadas || []);

  // Filtrado para vista de Calificaciones
  const notasFiltradas = notasOrdenadas.filter((n: any) => {
    if (filtroTrimestre === 'todos') return true;
    return String(n.trimestre) === filtroTrimestre;
  });

  // Filtrado para vista de Asistencias
  const asistenciasFiltradas = asistenciasOrdenadas.filter((a: any) => {
    if (filtroEstado === 'todos') return true;
    return a.estado === filtroEstado;
  });

  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* ── HEADER ── */}
          <View style={s.head}>
            <View style={s.headLeft}>
              {vista !== 'general' ? (
                <TouchableOpacity style={s.btnVolver} onPress={() => setVista('general')}>
                  <Ionicons name="arrow-back" size={20} color={COLORS.accent} />
                </TouchableOpacity>
              ) : (
                <View style={s.avatarBig}>
                  <Text style={s.avatarBigText}>
                    {`${(alum?.nombre || '')[0] || ''}${(alum?.apellido || '')[0] || ''}`.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.nombreTitulo} numberOfLines={1}>
                  {alum?.apellido}, {alum?.nombre}
                </Text>
                <Text style={s.cursoSubtitulo} numberOfLines={1}>
                  {cursoInfo?.materia ? `${cursoInfo.materia} (${cursoInfo.escuela || ''})` : 'Alumno'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={s.btnCerrar} onPress={onCerrar}>
              <Ionicons name="close" size={22} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {/* DNI y Contacto rápido */}
          {(alum?.dni || alum?.contacto) && (
            <View style={s.contactoRow}>
              {alum?.dni ? (
                <View style={s.contactoPill}>
                  <Ionicons name="card-outline" size={12} color={COLORS.secondary} />
                  <Text style={s.contactoText}>DNI: {alum.dni}</Text>
                </View>
              ) : null}
              {alum?.contacto ? (
                <View style={s.contactoPill}>
                  <Ionicons name="call-outline" size={12} color="#0284c7" />
                  <Text style={[s.contactoText, { color: '#0369a1' }]}>{alum.contacto}</Text>
                </View>
              ) : null}
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* ══════════════════════════════════════════════════════ */}
            {/* ── VISTA 1: RESUMEN GENERAL (DASHBOARD ESTILO PC) ── */}
            {/* ══════════════════════════════════════════════════════ */}
            {vista === 'general' && (
              <View style={{ gap: 14 }}>
                {/* ── BOTONES DE ACCESO DETALLADO ── */}
                <View style={s.accesosRow}>
                  <TouchableOpacity
                    style={[s.accesoTile, { borderColor: '#e0e7ff' }]}
                    onPress={() => setVista('calificaciones')}
                    activeOpacity={0.8}
                  >
                    <View style={[s.accesoTileIcon, { backgroundColor: '#eef2ff' }]}>
                      <Ionicons name="newspaper-outline" size={18} color="#4338ca" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.accesoTileTitle, { color: '#312e81' }]}>Ver Calificaciones</Text>
                      <Text style={s.accesoTileSub}>
                        {notasOrdenadas.length} {notasOrdenadas.length === 1 ? 'nota' : 'notas'} · Prom:{' '}
                        {promGeneral ?? '-'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.accesoTile, { borderColor: '#d1fae5' }]}
                    onPress={() => setVista('asistencias')}
                    activeOpacity={0.8}
                  >
                    <View style={[s.accesoTileIcon, { backgroundColor: '#ecfdf5' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.accesoTileTitle, { color: '#064e3b' }]}>Ver Asistencias</Text>
                      <Text style={s.accesoTileSub}>
                        {asistenciasOrdenadas.length} clases · {pctAsistencia !== null ? `${pctAsistencia}%` : 'S/D'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                  </TouchableOpacity>
                </View>

                {/* ── TARJETA: ASISTENCIA GENERAL & DESGLOSE ── */}
                <View style={s.cardSeccion}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardHeaderLabel}>ASISTENCIA GENERAL</Text>
                    <Text style={s.cardHeaderSub}>
                      {totalPresentes} presentes de {totalClases} clases
                    </Text>
                  </View>

                  <View style={s.asistenciaBigRow}>
                    <View>
                      <Text style={[s.asistenciaBigNumber, { color: '#059669' }]}>
                        {pctAsistencia !== null ? `${pctAsistencia}%` : 'S/D'}
                      </Text>
                      <Text style={s.asistenciaBigSub}>Presentismo total</Text>
                    </View>

                    <View style={s.asistenciaBadgesCol}>
                      <View style={[s.badgeItem, { backgroundColor: '#fee2e2' }]}>
                        <Ionicons name="close-circle" size={13} color="#dc2626" />
                        <Text style={[s.badgeItemText, { color: '#991b1b' }]}>
                          Ausentes: <Text style={{ fontWeight: '800' }}>{totalAusentes}</Text>
                        </Text>
                      </View>
                      <View style={[s.badgeItem, { backgroundColor: '#cffafe' }]}>
                        <Ionicons name="time" size={13} color="#0891b2" />
                        <Text style={[s.badgeItemText, { color: '#155e75' }]}>
                          Justificadas: <Text style={{ fontWeight: '800' }}>{totalJustificadas}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Badges de concepto */}
                  {(totalBuenConcepto > 0 || totalMalConcepto > 0) && (
                    <View style={s.conceptosPillsRow}>
                      {totalBuenConcepto > 0 && (
                        <View style={[s.conceptoPill, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                          <Text style={{ fontSize: 13 }}>😊</Text>
                          <Text style={[s.conceptoPillText, { color: '#166534' }]}>
                            {totalBuenConcepto} Buen Concepto
                          </Text>
                        </View>
                      )}
                      {totalMalConcepto > 0 && (
                        <View style={[s.conceptoPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                          <Text style={{ fontSize: 13 }}>😞</Text>
                          <Text style={[s.conceptoPillText, { color: '#991b1b' }]}>
                            {totalMalConcepto} Mal Concepto
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* ── TARJETA: HISTORIAL RECIENTE DE CLASES (LÍNEA DE TIEMPO) ── */}
                <View style={s.cardSeccion}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardHeaderLabel}>📅 HISTORIAL RECIENTE DE CLASES</Text>
                    <Text style={s.cardHeaderSub}>
                      Recientes → Antiguas ({asistenciasOrdenadas.length})
                    </Text>
                  </View>

                  {asistenciasOrdenadas.length === 0 ? (
                    <View style={s.emptyTimelineBox}>
                      <Text style={s.emptyTimelineText}>
                        Aún no hay registros de asistencia para este alumno.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timelineScroll}>
                      {asistenciasOrdenadas.slice(0, 15).map((asist: any, idx: number) => {
                        const cfg = obtenerConfigConcepto(asist.estado);
                        return (
                          <View key={`timeline-${asist.id || idx}`} style={s.timelineItem}>
                            <Text style={s.timelineFecha}>{formatearFecha(asist.fecha)}</Text>
                            <View style={[s.timelineIconBox, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                              <Text style={s.timelineEmoji}>{cfg.emoji}</Text>
                            </View>
                            <Text style={[s.timelineNombre, { color: cfg.color }]} numberOfLines={1}>
                              {cfg.nombre}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* ── TARJETA: PROMEDIOS POR TRIMESTRE (BARRAS VISUALES) ── */}
                <View style={s.cardSeccion}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.cardHeaderLabel}>CALIFICACIONES POR TRIMESTRE</Text>
                    <View style={s.promGeneralBadge}>
                      <Text style={s.promGeneralBadgeLabel}>Promedio:</Text>
                      <Text style={s.promGeneralBadgeVal}>
                        {promGeneral !== null && promGeneral !== undefined ? `${promGeneral}/10` : 'S/D'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.barrasTrimestreList}>
                    {/* 1° Trimestre */}
                    <View style={s.barraTrimestreRow}>
                      <Text style={s.barraTrimestreLabel}>1° Trimestre</Text>
                      <View style={s.barraFondo}>
                        <View
                          style={[
                            s.barraRelleno,
                            {
                              width: `${Math.min(Math.max((Number(promT1 || 0) / 10) * 100, 0), 100)}%`,
                              backgroundColor: Number(promT1) >= 6 ? COLORS.accent : '#f97316',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.barraTrimestreVal, Number(promT1) >= 6 && { color: COLORS.accent }]}>
                        {promT1 !== null && promT1 !== undefined && Number(promT1) > 0 ? promT1 : '-'}
                      </Text>
                    </View>

                    {/* 2° Trimestre */}
                    <View style={s.barraTrimestreRow}>
                      <Text style={s.barraTrimestreLabel}>2° Trimestre</Text>
                      <View style={s.barraFondo}>
                        <View
                          style={[
                            s.barraRelleno,
                            {
                              width: `${Math.min(Math.max((Number(promT2 || 0) / 10) * 100, 0), 100)}%`,
                              backgroundColor: Number(promT2) >= 6 ? COLORS.accent : '#f97316',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.barraTrimestreVal, Number(promT2) >= 6 && { color: COLORS.accent }]}>
                        {promT2 !== null && promT2 !== undefined && Number(promT2) > 0 ? promT2 : '-'}
                      </Text>
                    </View>

                    {/* 3° Trimestre */}
                    <View style={s.barraTrimestreRow}>
                      <Text style={s.barraTrimestreLabel}>3° Trimestre</Text>
                      <View style={s.barraFondo}>
                        <View
                          style={[
                            s.barraRelleno,
                            {
                              width: `${Math.min(Math.max((Number(promT3 || 0) / 10) * 100, 0), 100)}%`,
                              backgroundColor: Number(promT3) >= 6 ? COLORS.accent : '#f97316',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.barraTrimestreVal, Number(promT3) >= 6 && { color: COLORS.accent }]}>
                        {promT3 !== null && promT3 !== undefined && Number(promT3) > 0 ? promT3 : '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── VISTA 2: LISTA DETALLADA DE CALIFICACIONES ── */}
            {/* ══════════════════════════════════════════════════════ */}
            {vista === 'calificaciones' && (
              <View style={{ gap: 12 }}>
                <View style={s.filtroRow}>
                  <Text style={s.filtroLabel}>Filtrar por Trimestre:</Text>
                  <View style={s.filtroTabs}>
                    {['todos', '1', '2', '3'].map((t) => (
                      <TouchableOpacity
                        key={`tab-trim-${t}`}
                        style={[s.filtroTab, filtroTrimestre === t && s.filtroTabActivo]}
                        onPress={() => setFiltroTrimestre(t)}
                      >
                        <Text style={[s.filtroTabText, filtroTrimestre === t && s.filtroTabTextActivo]}>
                          {t === 'todos' ? 'Todos' : `${t}°`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {notasFiltradas.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="document-text-outline" size={32} color={COLORS.secondary} />
                    <Text style={s.emptyText}>No hay calificaciones registradas en este período.</Text>
                  </View>
                ) : (
                  notasFiltradas.map((n: any, idx: number) => {
                    const numValor = Number(n.valor);
                    const aprobado = numValor >= 6;
                    return (
                      <View key={`nota-${n.id || idx}`} style={s.itemDetalle}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTitulo}>{n.tipo || 'Evaluación'}</Text>
                          <Text style={s.itemSub}>
                            {n.trimestre ? `${n.trimestre}° Trimestre` : ''}
                            {n.fecha ? ` · ${formatearFecha(n.fecha)}` : ''}
                          </Text>
                        </View>
                        <View style={[s.notaBadge, aprobado ? s.notaBadgeAprobada : s.notaBadgeDesaprobada]}>
                          <Text style={[s.notaBadgeText, aprobado ? s.notaTextAprobada : s.notaTextDesaprobada]}>
                            {n.valor}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── VISTA 3: HISTORIAL DETALLADO DE ASISTENCIAS ── */}
            {/* ══════════════════════════════════════════════════════ */}
            {vista === 'asistencias' && (
              <View style={{ gap: 12 }}>
                <View style={s.filtroRow}>
                  <Text style={s.filtroLabel}>Filtrar por Estado:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {[
                      { key: 'todos', label: 'Todos' },
                      { key: 'ausente', label: 'Ausentes' },
                      { key: 'justificada', label: 'Justificadas' },
                      { key: 'presente_buen_concepto', label: 'Buen Concepto' },
                      { key: 'presente_mal_concepto', label: 'Mal Concepto' },
                    ].map((f) => (
                      <TouchableOpacity
                        key={`tab-asis-${f.key}`}
                        style={[s.filtroTab, filtroEstado === f.key && s.filtroTabActivo]}
                        onPress={() => setFiltroEstado(f.key)}
                      >
                        <Text style={[s.filtroTabText, filtroEstado === f.key && s.filtroTabTextActivo]}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {asistenciasFiltradas.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="calendar-outline" size={32} color={COLORS.secondary} />
                    <Text style={s.emptyText}>No hay asistencias registradas con este filtro.</Text>
                  </View>
                ) : (
                  asistenciasFiltradas.map((a: any, idx: number) => {
                    const cfg = obtenerConfigConcepto(a.estado);
                    return (
                      <View key={`asis-${a.id || idx}`} style={s.itemDetalle}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[s.timelineIconBoxSmall, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                            <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
                          </View>
                          <View>
                            <Text style={s.itemTitulo}>{cfg.nombre}</Text>
                            <Text style={s.itemSub}>Clase del {formatearFecha(a.fecha)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    maxHeight: '88%',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  btnVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatarBig: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
  },
  nombreTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  cursoSubtitulo: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  btnCerrar: {
    padding: 6,
  },
  contactoRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  contactoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  contactoText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  accesosRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  accesoTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  accesoTileIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accesoTileTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  accesoTileSub: {
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 1,
  },
  cardSeccion: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },
  cardHeaderSub: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  asistenciaBigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  asistenciaBigNumber: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  asistenciaBigSub: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  asistenciaBadgesCol: {
    gap: 6,
    alignItems: 'flex-end',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  badgeItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  conceptosPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  conceptoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  conceptoPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyTimelineBox: {
    padding: 12,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontStyle: 'italic',
  },
  timelineScroll: {
    gap: 10,
    paddingVertical: 6,
  },
  timelineItem: {
    alignItems: 'center',
    minWidth: 46,
  },
  timelineFecha: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  timelineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconBoxSmall: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineEmoji: {
    fontSize: 17,
  },
  timelineNombre: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    maxWidth: 50,
  },
  promGeneralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  promGeneralBadgeLabel: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
  },
  promGeneralBadgeVal: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.accent,
  },
  barrasTrimestreList: {
    gap: 10,
    marginTop: 4,
  },
  barraTrimestreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barraTrimestreLabel: {
    width: 80,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  barraFondo: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 4,
  },
  barraTrimestreVal: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  filtroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  filtroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  filtroTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  filtroTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  filtroTabActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filtroTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  filtroTabTextActivo: {
    color: '#fff',
  },
  itemDetalle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  itemTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  itemSub: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
  },
  notaBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notaBadgeAprobada: {
    backgroundColor: '#dcfce7',
  },
  notaBadgeDesaprobada: {
    backgroundColor: '#fee2e2',
  },
  notaBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  notaTextAprobada: {
    color: '#16a34a',
  },
  notaTextDesaprobada: {
    color: '#dc2626',
  },
  emptyBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontStyle: 'italic',
  },
});
