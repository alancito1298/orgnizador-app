import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { apiFetch } from '../../api/client';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../../theme';
import {
  exportarAsistenciasExcelXlsx,
  exportarInformePedagogicoPdf,
} from '../../utils/exportUtils';
import { useOfflineStore } from '../../utils/offlineSync';

export type EstadoVisualAsistencia =
  | 'vacio'
  | 'presente'
  | 'presente_buen_concepto'
  | 'presente_mal_concepto'
  | 'ausente'
  | 'justificada'
  | 'media_falta';

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

interface AsistenciaRaw {
  id: number;
  alumnoCursoId: number;
  fecha: string;
  estado: string;
  trimestre?: number;
}

interface SabanaAsistenciasProps {
  curso: {
    id: number;
    materia: string;
    anio: string | number;
    escuela: string;
  };
  inscripciones: Inscripcion[];
  asistencias: AsistenciaRaw[];
  onAsistenciasUpdated?: () => void;
  trimestreInicial?: number;
}

const ESTADOS_CONFIG: Record<
  EstadoVisualAsistencia,
  {
    label: string;
    shortLabel: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    iconName?: keyof typeof Ionicons.glyphMap;
  }
> = {
  vacio: {
    label: 'Sin registrar',
    shortLabel: '-',
    bgColor: '#f1f5f9',
    textColor: '#94a3b8',
    borderColor: '#e2e8f0',
  },
  presente: {
    label: 'Presente',
    shortLabel: 'P',
    bgColor: '#10b981',
    textColor: '#ffffff',
    borderColor: '#059669',
  },
  presente_buen_concepto: {
    label: 'Pres. Buen Concepto',
    shortLabel: 'P+',
    bgColor: '#059669',
    textColor: '#ffffff',
    borderColor: '#047857',
  },
  presente_mal_concepto: {
    label: 'Pres. Mal Concepto',
    shortLabel: 'P-',
    bgColor: '#f59e0b',
    textColor: '#ffffff',
    borderColor: '#d97706',
  },
  ausente: {
    label: 'Ausente',
    shortLabel: 'A',
    bgColor: '#ef4444',
    textColor: '#ffffff',
    borderColor: '#dc2626',
  },
  justificada: {
    label: 'Justificada',
    shortLabel: 'J',
    bgColor: '#0284c7',
    textColor: '#ffffff',
    borderColor: '#0369a1',
  },
  media_falta: {
    label: '½ Falta',
    shortLabel: '½',
    bgColor: '#eab308',
    textColor: '#ffffff',
    borderColor: '#ca8a04',
  },
};

const CICLO_ROTACION: EstadoVisualAsistencia[] = [
  'vacio',
  'presente',
  'ausente',
  'justificada',
  'media_falta',
  'presente_mal_concepto',
];

export default function SabanaAsistencias({
  curso,
  inscripciones,
  asistencias,
  onAsistenciasUpdated,
  trimestreInicial = 1,
}: SabanaAsistenciasProps) {
  const [trimestre, setTrimestre] = useState<number>(trimestreInicial);
  const [vistaModo, setVistaModo] = useState<'sabana' | 'lista'>('sabana');

  // Matriz de asistencias: [alumnoCursoId][fecha] = estado
  const [matrizEstados, setMatrizEstados] = useState<Record<number, Record<string, EstadoVisualAsistencia>>>({});
  const [matrizIds, setMatrizIds] = useState<Record<number, Record<string, number | null>>>({});
  const [fechas, setFechas] = useState<string[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');

  // Modales
  const [modalNuevaFecha, setModalNuevaFecha] = useState(false);
  const [inputFecha, setInputFecha] = useState(new Date().toISOString().split('T')[0]);
  const [modalPickerEstado, setModalPickerEstado] = useState<{
    visible: boolean;
    inscripcionId: number;
    alumnoNombre: string;
    fecha: string;
    estadoActual: EstadoVisualAsistencia;
  } | null>(null);

  // Estados de carga y guardado
  const [guardando, setGuardando] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState<Set<string>>(new Set());

  // Alumnos ordenados alfabéticamente
  const alumnosOrdenados = useMemo(() => {
    return [...inscripciones].sort((a, b) => {
      const apA = (a.alumno?.apellido || '').toLowerCase();
      const apB = (b.alumno?.apellido || '').toLowerCase();
      if (apA !== apB) return apA.localeCompare(apB);
      return (a.alumno?.nombre || '').localeCompare(b.alumno?.nombre || '');
    });
  }, [inscripciones]);

  // Función para determinar el trimestre de una fecha
  const getTrimestreDeFecha = useCallback((fechaStr: string): number => {
    try {
      const parts = fechaStr.split('-');
      if (parts.length >= 2) {
        const mes = parseInt(parts[1], 10);
        if (mes <= 5) return 1;
        if (mes <= 8) return 2;
        return 3;
      }
    } catch {}
    return 1;
  }, []);

  // Inicializar matriz desde props
  useEffect(() => {
    const rawFechasSet = new Set<string>();
    const nuevasEstados: Record<number, Record<string, EstadoVisualAsistencia>> = {};
    const nuevosIds: Record<number, Record<string, number | null>> = {};

    inscripciones.forEach((i) => {
      nuevasEstados[i.id] = {};
      nuevosIds[i.id] = {};
    });

    asistencias.forEach((a) => {
      const f = a.fecha.split('T')[0];
      rawFechasSet.add(f);

      if (nuevasEstados[a.alumnoCursoId]) {
        let est: EstadoVisualAsistencia = 'vacio';
        const raw = a.estado?.toLowerCase() || '';
        if (raw.includes('buen_concepto')) est = 'presente_buen_concepto';
        else if (raw.includes('mal_concepto')) est = 'presente_mal_concepto';
        else if (raw === 'presente') est = 'presente';
        else if (raw === 'ausente') est = 'ausente';
        else if (raw === 'justificada') est = 'justificada';
        else if (raw === 'media_falta') est = 'media_falta';

        nuevasEstados[a.alumnoCursoId][f] = est;
        nuevosIds[a.alumnoCursoId][f] = a.id;
      }
    });

    const ordenadas = Array.from(rawFechasSet).sort().reverse();
    if (ordenadas.length === 0) {
      const hoy = new Date().toISOString().split('T')[0];
      ordenadas.push(hoy);
    }

    setFechas(ordenadas);
    setFechaSeleccionada(ordenadas[0] || new Date().toISOString().split('T')[0]);
    setMatrizEstados(nuevasEstados);
    setMatrizIds(nuevosIds);
    setCambiosPendientes(new Set());
  }, [asistencias, inscripciones]);

  // Fechas filtradas según el trimestre seleccionado
  const fechasFiltradas = useMemo(() => {
    if (trimestre === 4) return fechas; // 4 = Anual / Todas
    return fechas.filter((f) => getTrimestreDeFecha(f) === trimestre);
  }, [fechas, trimestre, getTrimestreDeFecha]);

  // Alternar estado de una celda en rotación rápida
  const handleToggleEstado = (alumnoCursoId: number, fecha: string) => {
    const actual = matrizEstados[alumnoCursoId]?.[fecha] || 'vacio';
    const nextIdx = (CICLO_ROTACION.indexOf(actual) + 1) % CICLO_ROTACION.length;
    const nuevoEstado = CICLO_ROTACION[nextIdx];

    setMatrizEstados((prev) => ({
      ...prev,
      [alumnoCursoId]: {
        ...(prev[alumnoCursoId] || {}),
        [fecha]: nuevoEstado,
      },
    }));

    setCambiosPendientes((prev) => {
      const next = new Set(prev);
      next.add(`${alumnoCursoId}__${fecha}`);
      return next;
    });
  };

  // Abrir selector modal para elegir estado específico
  const handleOpenPicker = (insc: Inscripcion, fecha: string) => {
    const estadoActual = matrizEstados[insc.id]?.[fecha] || 'vacio';
    setModalPickerEstado({
      visible: true,
      inscripcionId: insc.id,
      alumnoNombre: `${insc.alumno?.apellido}, ${insc.alumno?.nombre}`,
      fecha,
      estadoActual,
    });
  };

  const handleSeleccionarEstadoDirecto = (nuevoEstado: EstadoVisualAsistencia) => {
    if (!modalPickerEstado) return;
    const { inscripcionId, fecha } = modalPickerEstado;

    setMatrizEstados((prev) => ({
      ...prev,
      [inscripcionId]: {
        ...(prev[inscripcionId] || {}),
        [fecha]: nuevoEstado,
      },
    }));

    setCambiosPendientes((prev) => {
      const next = new Set(prev);
      next.add(`${inscripcionId}__${fecha}`);
      return next;
    });

    setModalPickerEstado(null);
  };

  // Agregar nueva fecha/columna
  const handleAgregarFecha = () => {
    const f = inputFecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      Alert.alert('Formato inválido', 'Usá el formato AAAA-MM-DD (ej: 2026-10-19)');
      return;
    }

    if (fechas.includes(f)) {
      Alert.alert('Fecha existente', 'Ya existe una columna para la fecha ' + f);
      setFechaSeleccionada(f);
      setModalNuevaFecha(false);
      return;
    }

    const nuevasFechas = [f, ...fechas].sort().reverse();
    setFechas(nuevasFechas);
    setFechaSeleccionada(f);
    setModalNuevaFecha(false);

    // Seleccionar automáticamente el trimestre al que corresponde la nueva fecha
    const trimDeFecha = getTrimestreDeFecha(f);
    if (trimDeFecha !== trimestre && trimestre !== 4) {
      setTrimestre(trimDeFecha);
    }
  };

  // Marcar todos presentes en la fecha seleccionada
  const handleTodosPresentesEnFecha = (fechaTarget: string) => {
    Alert.alert(
      'Marcar Todos Presentes',
      `¿Deseás marcar PRESENTES a los ${alumnosOrdenados.length} estudiantes el día ${fechaTarget}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            const nextCambios = new Set(cambiosPendientes);
            setMatrizEstados((prev) => {
              const copia = { ...prev };
              alumnosOrdenados.forEach((insc) => {
                copia[insc.id] = {
                  ...(copia[insc.id] || {}),
                  [fechaTarget]: 'presente',
                };
                nextCambios.add(`${insc.id}__${fechaTarget}`);
              });
              return copia;
            });
            setCambiosPendientes(nextCambios);
          },
        },
      ]
    );
  };

  // Guardar todos los cambios pendientes
  const handleGuardarCambios = async () => {
    if (cambiosPendientes.size === 0) {
      Alert.alert('Sin cambios', 'No hay asistencias modificadas pendientes de guardar.');
      return;
    }

    setGuardando(true);
    let guardadosCount = 0;
    const errors: any[] = [];

    try {
      const keys = Array.from(cambiosPendientes);

      for (const key of keys) {
        const [idStr, fecha] = key.split('__');
        const alumnoCursoId = parseInt(idStr, 10);
        const estadoVisual = matrizEstados[alumnoCursoId]?.[fecha] || 'vacio';
        const idExistente = matrizIds[alumnoCursoId]?.[fecha];
        const trimCalculado = getTrimestreDeFecha(fecha);

        try {
          if (estadoVisual === 'vacio') {
            if (idExistente) {
              await apiFetch(`/asistencias/${idExistente}`, { method: 'DELETE', auth: true });
              setMatrizIds((prev) => {
                const copia = { ...prev };
                if (copia[alumnoCursoId]) copia[alumnoCursoId][fecha] = null;
                return copia;
              });
            }
          } else {
            const res = await apiFetch<any>('/asistencias', {
              method: 'POST',
              auth: true,
              body: JSON.stringify({
                fecha,
                estado: estadoVisual,
                trimestre: trimCalculado,
                alumnoCursoId,
              }),
            });

            if (res?.id) {
              setMatrizIds((prev) => {
                const copia = { ...prev };
                if (copia[alumnoCursoId]) copia[alumnoCursoId][fecha] = res.id;
                return copia;
              });
            }
          }
          guardadosCount++;
        } catch (err) {
          errors.push(err);
        }
      }

      setCambiosPendientes(new Set());
      const isOff = useOfflineStore.getState().isOffline;
      if (isOff) {
        Alert.alert(
          '¡Guardado Localmente!',
          `Se guardaron ${guardadosCount} registros en el celular. Se sincronizarán automáticamente con la nube cuando recuperes señal.`
        );
      } else {
        Alert.alert('¡Sábana Guardada!', `Se guardaron ${guardadosCount} registros de asistencia con éxito.`);
      }
      onAsistenciasUpdated?.();
    } catch (err) {
      Alert.alert('Atención', 'Ocurrió un error al persistir algunas asistencias.');
    } finally {
      setGuardando(false);
    }
  };

  // Estadísticas calculadas en tiempo real para un alumno
  const getStatsAlumno = useCallback(
    (alumnoCursoId: number) => {
      const fechasAContar = fechasFiltradas;
      let presentes = 0;
      let ausentes = 0;
      let justificadas = 0;
      let mediaFalta = 0;
      let totalClases = 0;

      fechasAContar.forEach((f) => {
        const est = matrizEstados[alumnoCursoId]?.[f] || 'vacio';
        if (est !== 'vacio') {
          totalClases++;
          if (est === 'presente' || est === 'presente_buen_concepto') presentes++;
          else if (est === 'presente_mal_concepto') presentes++;
          else if (est === 'ausente') ausentes++;
          else if (est === 'justificada') justificadas++;
          else if (est === 'media_falta') {
            mediaFalta++;
            presentes += 0.5;
            ausentes += 0.5;
          }
        }
      });

      const pct = totalClases > 0 ? Math.round((presentes / totalClases) * 100) : 0;
      return {
        presentes: Math.floor(presentes),
        ausentes: Math.ceil(ausentes),
        justificadas,
        totalClases,
        pct,
      };
    },
    [fechasFiltradas, matrizEstados]
  );

  // Formato amigable de fecha: DD/MM y Día
  const formatFechaHeader = (fechaStr: string) => {
    try {
      const [y, m, d] = fechaStr.split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const diaNom = dias[date.getDay()] || '';
      return {
        diaMes: `${d}/${m}`,
        diaNom,
      };
    } catch {
      return { diaMes: fechaStr, diaNom: '' };
    }
  };

  return (
    <View style={s.container}>
      {/* ── BARRA DE TÍTULO Y CONTROLES SUPERIORES ── */}
      <View style={s.headerBox}>
        <View style={s.headerTitleRow}>
          <View style={s.headerIconBox}>
            <MaterialCommunityIcons name="table-large" size={20} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Sábana de Asistencias</Text>
            <Text style={s.headerSub}>Matriz interactiva de control diario y trimestral</Text>
          </View>

          {/* Badge de Cambios Pendientes */}
          {cambiosPendientes.size > 0 && (
            <View style={s.badgePendientes}>
              <Text style={s.badgePendientesText}>{cambiosPendientes.size} sin guardar</Text>
            </View>
          )}
        </View>

        {/* Selector de Trimestres */}
        <View style={s.trimestresRow}>
          {[1, 2, 3].map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.trimBtn, trimestre === t && s.trimBtnActive]}
              onPress={() => setTrimestre(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.trimBtnText, trimestre === t && s.trimBtnTextActive]}>
                {t}° Trimestre
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.trimBtn, trimestre === 4 && s.trimBtnActive]}
            onPress={() => setTrimestre(4)}
            activeOpacity={0.8}
          >
            <Text style={[s.trimBtnText, trimestre === 4 && s.trimBtnTextActive]}>
              Todo el Año
            </Text>
          </TouchableOpacity>
        </View>

        {/* Barra de Acciones Principales */}
        <View style={s.actionsBar}>
          {/* Botón Agregar Fecha */}
          <TouchableOpacity
            style={s.btnActionNeutral}
            onPress={() => {
              setInputFecha(new Date().toISOString().split('T')[0]);
              setModalNuevaFecha(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={15} color={COLORS.accent} />
            <Text style={s.btnActionNeutralText}>+ Fecha</Text>
          </TouchableOpacity>

          {/* Botón Todos Presentes */}
          <TouchableOpacity
            style={s.btnActionNeutral}
            onPress={() => handleTodosPresentesEnFecha(fechaSeleccionada || fechas[0])}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-done" size={15} color="#059669" />
            <Text style={[s.btnActionNeutralText, { color: '#059669' }]}>Todos Pres.</Text>
          </TouchableOpacity>

          {/* Botón Guardar Sábana */}
          <TouchableOpacity
            style={[
              s.btnGuardar,
              cambiosPendientes.size > 0 ? s.btnGuardarActivo : s.btnGuardarInactivo,
            ]}
            onPress={handleGuardarCambios}
            disabled={guardando || cambiosPendientes.size === 0}
            activeOpacity={0.85}
          >
            {guardando ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="save" size={15} color="#ffffff" />
                <Text style={s.btnGuardarText}>Guardar</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Selector de Modo: Sábana / Lista */}
          <TouchableOpacity
            style={s.btnModoSwitch}
            onPress={() => setVistaModo(vistaModo === 'sabana' ? 'lista' : 'sabana')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={vistaModo === 'sabana' ? 'list-outline' : 'grid-outline'}
              size={15}
              color={COLORS.accent}
            />
            <Text style={s.btnModoSwitchText}>
              {vistaModo === 'sabana' ? 'Modo Lista' : 'Modo Sábana'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── VISTA 1: MODO SÁBANA (MATRIZ INTERACTIVA COMPLETA) ── */}
      {vistaModo === 'sabana' ? (
        <View style={s.sabanaCard}>
          {fechasFiltradas.length === 0 ? (
            <View style={s.emptyBox}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={38} color={COLORS.secondary} />
              <Text style={s.emptyTitle}>No hay fechas registradas en el {trimestre}° Trimestre</Text>
              <Text style={s.emptySub}>Tocá "+ Fecha" para crear la primera columna de asistencia.</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => {
                  setInputFecha(new Date().toISOString().split('T')[0]);
                  setModalNuevaFecha(true);
                }}
              >
                <Text style={s.emptyBtnText}>+ Agregar Fecha de Hoy</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={s.horizontalScroll}>
              <View>
                {/* ── ENCABEZADO DE LA SÁBANA ── */}
                <View style={s.tableHeaderRow}>
                  {/* Columna N° y Alumno (Fija/Destacada) */}
                  <View style={s.thAlumno}>
                    <Text style={s.thText}>ESTUDIANTE ({alumnosOrdenados.length})</Text>
                  </View>

                  {/* Columnas de Fechas */}
                  {fechasFiltradas.map((fecha) => {
                    const info = formatFechaHeader(fecha);
                    const isSelected = fecha === fechaSeleccionada;

                    return (
                      <TouchableOpacity
                        key={fecha}
                        style={[s.thFecha, isSelected && s.thFechaActive]}
                        onPress={() => setFechaSeleccionada(fecha)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.thFechaDiaNom, isSelected && s.thFechaDiaNomActive]}>
                          {info.diaNom}
                        </Text>
                        <Text style={[s.thFechaDiaMes, isSelected && s.thFechaDiaMesActive]}>
                          {info.diaMes}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Columnas de Resumen */}
                  <View style={s.thStat}>
                    <Text style={s.thStatText}>P</Text>
                  </View>
                  <View style={s.thStat}>
                    <Text style={s.thStatText}>A</Text>
                  </View>
                  <View style={[s.thStat, { width: 56 }]}>
                    <Text style={s.thStatText}>% Asist</Text>
                  </View>
                </View>

                {/* ── FILAS DE ALUMNOS Y CELDAS INTERACTIVAS ── */}
                {alumnosOrdenados.map((insc, idx) => {
                  const stats = getStatsAlumno(insc.id);
                  const isPar = idx % 2 === 0;

                  return (
                    <View key={insc.id} style={[s.tableRow, isPar && s.tableRowPar]}>
                      {/* Columna Alumno */}
                      <View style={s.tdAlumno}>
                        <Text style={s.tdNumero}>{String(idx + 1).padStart(2, '0')}</Text>
                        <Text style={s.tdAlumnoNombre} numberOfLines={1}>
                          {insc.alumno?.apellido}, {insc.alumno?.nombre}
                        </Text>
                      </View>

                      {/* Celdas por Fecha */}
                      {fechasFiltradas.map((fecha) => {
                        const estado = matrizEstados[insc.id]?.[fecha] || 'vacio';
                        const cfg = ESTADOS_CONFIG[estado] || ESTADOS_CONFIG.vacio;

                        return (
                          <TouchableOpacity
                            key={fecha}
                            style={[
                              s.tdCell,
                              { backgroundColor: cfg.bgColor, borderColor: cfg.borderColor },
                            ]}
                            onPress={() => handleToggleEstado(insc.id, fecha)}
                            onLongPress={() => handleOpenPicker(insc, fecha)}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.tdCellText, { color: cfg.textColor }]}>
                              {cfg.shortLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Totales del Alumno */}
                      <View style={s.tdStat}>
                        <Text style={[s.tdStatText, { color: '#059669', fontWeight: '800' }]}>
                          {stats.presentes}
                        </Text>
                      </View>
                      <View style={s.tdStat}>
                        <Text style={[s.tdStatText, { color: '#dc2626', fontWeight: '800' }]}>
                          {stats.ausentes}
                        </Text>
                      </View>
                      <View style={[s.tdStat, { width: 56 }]}>
                        <View
                          style={[
                            s.pctBadge,
                            stats.pct >= 75 ? s.pctBadgeSuccess : s.pctBadgeWarning,
                          ]}
                        >
                          <Text
                            style={[
                              s.pctBadgeText,
                              stats.pct >= 75 ? s.pctTextSuccess : s.pctTextWarning,
                            ]}
                          >
                            {stats.pct}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* ── LEYENDA INFORMATIVA INFERIOR ── */}
          <View style={s.leyendaContainer}>
            <Text style={s.leyendaTitle}>Referencias de Asistencia (tocá una celda para alternar):</Text>
            <View style={s.leyendaItemsWrap}>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#10b981' }]} />
                <Text style={s.leyendaText}>P: Presente</Text>
              </View>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#ef4444' }]} />
                <Text style={s.leyendaText}>A: Ausente</Text>
              </View>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#0284c7' }]} />
                <Text style={s.leyendaText}>J: Justificada</Text>
              </View>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#eab308' }]} />
                <Text style={s.leyendaText}>½: Media Falta</Text>
              </View>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#059669' }]} />
                <Text style={s.leyendaText}>P+: Buen Concepto</Text>
              </View>
              <View style={s.leyendaItem}>
                <View style={[s.leyendaColorBox, { backgroundColor: '#f59e0b' }]} />
                <Text style={s.leyendaText}>P-: Mal Concepto</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* ── VISTA 2: MODO LISTA RÁPIDA (CARGA DEL DÍA) ── */
        <View style={s.listaCard}>
          {/* Selector de Fecha Activa */}
          <View style={s.listaFechaSelector}>
            <Ionicons name="calendar" size={17} color={COLORS.accent} />
            <Text style={s.listaFechaLabel}>Asistencia para el día:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.fechasChipsScroll}>
              {fechas.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[s.fechaChip, f === fechaSeleccionada && s.fechaChipActive]}
                  onPress={() => setFechaSeleccionada(f)}
                >
                  <Text style={[s.fechaChipText, f === fechaSeleccionada && s.fechaChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Tarjetas individuales de estudiantes */}
          {alumnosOrdenados.map((insc, idx) => {
            const estadoActual = matrizEstados[insc.id]?.[fechaSeleccionada] || 'vacio';

            return (
              <View key={insc.id} style={s.listaAlumnoItem}>
                <View style={s.listaAlumnoLeft}>
                  <Text style={s.listaAlumnoNum}>{idx + 1}</Text>
                  <Text style={s.listaAlumnoNombre} numberOfLines={1}>
                    {insc.alumno?.apellido}, {insc.alumno?.nombre}
                  </Text>
                </View>

                {/* Botones de estado rápido */}
                <View style={s.pillsContainer}>
                  {(['presente', 'ausente', 'justificada', 'media_falta'] as EstadoVisualAsistencia[]).map(
                    (st) => {
                      const cfg = ESTADOS_CONFIG[st];
                      const active = estadoActual === st;

                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            s.pillBtn,
                            active && { backgroundColor: cfg.bgColor, borderColor: cfg.borderColor },
                          ]}
                          onPress={() => {
                            setMatrizEstados((prev) => ({
                              ...prev,
                              [insc.id]: {
                                ...(prev[insc.id] || {}),
                                [fechaSeleccionada]: st,
                              },
                            }));
                            setCambiosPendientes((prev) => {
                              const n = new Set(prev);
                              n.add(`${insc.id}__${fechaSeleccionada}`);
                              return n;
                            });
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.pillBtnText, active && { color: '#ffffff', fontWeight: '800' }]}>
                            {cfg.shortLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── BOTONES INFERIORES DE EXPORTACIÓN ── */}
      <View style={s.exportFooter}>
        <TouchableOpacity
          style={s.exportBtnExcel}
          onPress={() => {
            exportarAsistenciasExcelXlsx(
              { materia: curso.materia, anio: String(curso.anio), escuela: curso.escuela },
              inscripciones,
              asistencias
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={16} color="#047857" />
          <Text style={s.exportBtnTextExcel}>Exportar Sábana Excel (.xlsx)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.exportBtnPdf}
          onPress={() => {
            exportarInformePedagogicoPdf(
              { materia: curso.materia, anio: String(curso.anio), escuela: curso.escuela },
              inscripciones,
              asistencias,
              []
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="print-outline" size={16} color="#7c3aed" />
          <Text style={s.exportBtnTextPdf}>Generar Informe PDF</Text>
        </TouchableOpacity>
      </View>

      {/* ── MODAL AGREGAR FECHA ── */}
      <Modal visible={modalNuevaFecha} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Ionicons name="calendar" size={22} color={COLORS.accent} />
              <Text style={s.modalTitle}>Agregar Nueva Fecha</Text>
            </View>

            <Text style={s.modalSub}>
              Ingresá la fecha de la clase para agregar una nueva columna a la sábana:
            </Text>

            <TextInput
              style={s.modalInput}
              value={inputFecha}
              onChangeText={setInputFecha}
              placeholder="AAAA-MM-DD (ej: 2026-10-19)"
              placeholderTextColor={COLORS.secondary}
              keyboardType="numbers-and-punctuation"
            />

            <View style={s.modalQuickBtns}>
              <TouchableOpacity
                style={s.quickBtn}
                onPress={() => setInputFecha(new Date().toISOString().split('T')[0])}
              >
                <Text style={s.quickBtnText}>Fecha de Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.quickBtn}
                onPress={() => {
                  const ayer = new Date();
                  ayer.setDate(ayer.getDate() - 1);
                  setInputFecha(ayer.toISOString().split('T')[0]);
                }}
              >
                <Text style={s.quickBtnText}>Ayer</Text>
              </TouchableOpacity>
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalBtnCancel}
                onPress={() => setModalNuevaFecha(false)}
              >
                <Text style={s.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalBtnConfirm}
                onPress={handleAgregarFecha}
              >
                <Text style={s.modalBtnConfirmText}>Agregar Columna</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL PICKER DIRECTO DE ESTADO (LONG PRESS) ── */}
      <Modal
        visible={modalPickerEstado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPickerEstado(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalPickerEstado(null)}
        >
          <View style={s.pickerBox}>
            <Text style={s.pickerTitle}>{modalPickerEstado?.alumnoNombre}</Text>
            <Text style={s.pickerFecha}>Fecha: {modalPickerEstado?.fecha}</Text>

            <View style={s.pickerOptionsGrid}>
              {(Object.keys(ESTADOS_CONFIG) as EstadoVisualAsistencia[]).map((stKey) => {
                const conf = ESTADOS_CONFIG[stKey];
                const isSelected = modalPickerEstado?.estadoActual === stKey;

                return (
                  <TouchableOpacity
                    key={stKey}
                    style={[
                      s.pickerOptionBtn,
                      { backgroundColor: conf.bgColor, borderColor: conf.borderColor },
                      isSelected && s.pickerOptionSelected,
                    ]}
                    onPress={() => handleSeleccionarEstadoDirecto(stKey)}
                  >
                    <Text style={[s.pickerOptionText, { color: conf.textColor }]}>
                      {conf.label} ({conf.shortLabel})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  headerBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  badgePendientes: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  badgePendientesText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  trimestresRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#f1f5f9',
    padding: 3,
    borderRadius: RADIUS.lg,
  },
  trimBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trimBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  trimBtnTextActive: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnActionNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  btnActionNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  btnGuardar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  btnGuardarActivo: {
    backgroundColor: '#7c3aed',
  },
  btnGuardarInactivo: {
    backgroundColor: '#cbd5e1',
  },
  btnGuardarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnModoSwitch: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  btnModoSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // ── SÁBANA ──
  sabanaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: RADIUS.lg,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  thAlumno: {
    width: 155,
    paddingLeft: 6,
  },
  thText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c4b5fd',
    letterSpacing: 0.5,
  },
  thFecha: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 6,
    marginHorizontal: 1,
  },
  thFechaActive: {
    backgroundColor: '#4338ca',
  },
  thFechaDiaNom: {
    fontSize: 9,
    fontWeight: '700',
    color: '#a5b4fc',
  },
  thFechaDiaNomActive: {
    color: '#fbbf24',
  },
  thFechaDiaMes: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  thFechaDiaMesActive: {
    color: '#ffffff',
  },
  thStat: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thStatText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e2e8f0',
  },

  // Filas
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
  },
  tableRowPar: {
    backgroundColor: '#f8fafc',
  },
  tdAlumno: {
    width: 155,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  tdNumero: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
    width: 16,
  },
  tdAlumnoNombre: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.onSurface,
    flex: 1,
  },
  tdCell: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 1,
  },
  tdCellText: {
    fontSize: 11,
    fontWeight: '900',
  },
  tdStat: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdStatText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pctBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pctBadgeSuccess: {
    backgroundColor: '#ecfdf5',
  },
  pctBadgeWarning: {
    backgroundColor: '#fff1f2',
  },
  pctBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  pctTextSuccess: {
    color: '#059669',
  },
  pctTextWarning: {
    color: '#e11d48',
  },

  // Leyenda
  leyendaContainer: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.sm,
    gap: 6,
  },
  leyendaTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  leyendaItemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  leyendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  leyendaColorBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  leyendaText: {
    fontSize: 10,
    color: COLORS.onSurface,
    fontWeight: '600',
  },

  // ── MODO LISTA ──
  listaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  listaFechaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  listaFechaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  fechasChipsScroll: {
    flexGrow: 0,
  },
  fechaChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    marginRight: 6,
  },
  fechaChipActive: {
    backgroundColor: COLORS.accent,
  },
  fechaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  fechaChipTextActive: {
    color: '#ffffff',
  },
  listaAlumnoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  listaAlumnoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 6,
  },
  listaAlumnoNum: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
    width: 18,
  },
  listaAlumnoNombre: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  pillBtn: {
    width: 32,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // ── EXPORTACIÓN FOOTER ──
  exportFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  exportBtnExcel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  exportBtnTextExcel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  exportBtnPdf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  exportBtnTextPdf: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6d28d9',
  },

  // Empty Box
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 11,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.secondary,
    lineHeight: 16,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  modalQuickBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
  },
  modalBtnCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
  },
  modalBtnConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Picker Directo
  pickerBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  pickerFecha: {
    fontSize: 11,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  pickerOptionsGrid: {
    gap: 6,
  },
  pickerOptionBtn: {
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    borderWidth: 2,
    borderColor: '#1e1b4b',
  },
  pickerOptionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
