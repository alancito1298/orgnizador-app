import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../api/client';
import AppButton from '../ui/AppButton';
import { COLORS, RADIUS, SPACING } from '../../theme';

interface AlumnoImportado {
  idTemp: string;
  apellido: string;
  nombre: string;
  dni?: string;
  contacto?: string;
  valido: boolean;
  seleccionado: boolean;
}

interface Props {
  abierto: boolean;
  cursoId: number;
  onCerrar: () => void;
  onImportados: () => void;
}

export default function ImportarAlumnosModal({ abierto, cursoId, onCerrar, onImportados }: Props) {
  const [textoPegado, setTextoPegado] = useState('');
  const [alumnosDetectados, setAlumnosDetectados] = useState<AlumnoImportado[]>([]);
  const [analizado, setAnalizado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  const parsearTexto = (raw: string) => {
    if (!raw.trim()) {
      Alert.alert('Texto vacío', 'Por favor pegá o escribí la lista de alumnos.');
      return;
    }

    const lineas = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const resultado: AlumnoImportado[] = [];

    lineas.forEach((linea, idx) => {
      const limpia = linea.replace(/^\d+[\.\-\)]\s*/, '').trim(); // Quitar números como "1. " o "1) "
      if (!limpia) return;

      let apellido = '';
      let nombre = '';
      let dni = '';
      let contacto = '';

      // Separación por tabulación, punto y coma o coma
      let partes: string[] = [];
      if (limpia.includes('\t')) partes = limpia.split('\t');
      else if (limpia.includes(';')) partes = limpia.split(';');
      else if (limpia.includes(',')) partes = limpia.split(',');
      else partes = [limpia];

      partes = partes.map((p) => p.trim()).filter((p) => p.length > 0);

      if (partes.length >= 2) {
        apellido = partes[0];
        nombre = partes[1];
        if (partes[2] && /^\d+$/.test(partes[2].replace(/\./g, ''))) {
          dni = partes[2].replace(/\./g, '');
        }
        if (partes[3]) contacto = partes[3];
      } else {
        // Un solo bloque: "Juan Perez" o "Perez Juan"
        const palabras = limpia.split(/\s+/);
        if (palabras.length >= 2) {
          nombre = palabras[0];
          apellido = palabras.slice(1).join(' ');
        } else {
          nombre = palabras[0];
          apellido = '';
        }
      }

      resultado.push({
        idTemp: `temp-${idx}-${Date.now()}`,
        apellido: apellido.trim(),
        nombre: nombre.trim(),
        dni: dni.trim() || undefined,
        contacto: contacto.trim() || undefined,
        valido: !!(apellido.trim() || nombre.trim()),
        seleccionado: true,
      });
    });

    setAlumnosDetectados(resultado);
    setAnalizado(true);
  };

  const toggleSeleccion = (idTemp: string) => {
    setAlumnosDetectados((prev) =>
      prev.map((a) => (a.idTemp === idTemp ? { ...a, seleccionado: !a.seleccionado } : a))
    );
  };

  const seleccionarTodos = (sel: boolean) => {
    setAlumnosDetectados((prev) => prev.map((a) => ({ ...a, seleccionado: sel })));
  };

  const pegarEjemplo = () => {
    const ejemplo = `Álvarez, Lucas\nBenítez, Sofía\nCastro, Mateo\nDomínguez, Valentina\nFernández, Thiago`;
    setTextoPegado(ejemplo);
    parsearTexto(ejemplo);
  };

  const handleEjecutarImportacion = async () => {
    const seleccionados = alumnosDetectados.filter((a) => a.seleccionado && a.valido);
    if (seleccionados.length === 0) {
      Alert.alert('Sin alumnos', 'Por favor seleccioná al menos un alumno para importar.');
      return;
    }

    setImportando(true);
    setProgreso({ actual: 0, total: seleccionados.length });

    let exitosos = 0;
    for (let i = 0; i < seleccionados.length; i++) {
      const a = seleccionados[i];
      try {
        const nuevo = await apiFetch<any>('/alumnos', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            nombre: a.nombre,
            apellido: a.apellido || a.nombre,
            dni: a.dni,
            contacto: a.contacto,
          }),
        });

        if (nuevo && nuevo.id) {
          await apiFetch('/inscripciones', {
            method: 'POST',
            auth: true,
            body: JSON.stringify({
              alumnoId: nuevo.id,
              cursoId,
            }),
          });
          exitosos++;
        }
      } catch (err) {
        console.error('Error importando:', a, err);
      }
      setProgreso({ actual: i + 1, total: seleccionados.length });
    }

    setImportando(false);
    Alert.alert('¡Importación Exitosa!', `Se importaron e inscribieron ${exitosos} alumnos en el curso.`);
    setTextoPegado('');
    setAlumnosDetectados([]);
    setAnalizado(false);
    onImportados();
    onCerrar();
  };

  const cantidadSeleccionados = alumnosDetectados.filter((a) => a.seleccionado).length;

  return (
    <Modal visible={abierto} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.iconBox}>
                <Ionicons name="cloud-upload" size={20} color="#059669" />
              </View>
              <View>
                <Text style={s.title}>IMPORTAR ALUMNOS</Text>
                <Text style={s.subtitle}>Copiar y pegar lista de nómina</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCerrar} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {!analizado ? (
            <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
              <View style={s.helpBox}>
                <Ionicons name="information-circle" size={18} color={COLORS.accent} />
                <Text style={s.helpText}>
                  Pegá una lista con 1 alumno por renglón. Se detectan formatos como{' '}
                  <Text style={{ fontWeight: '800' }}>Apellido, Nombre</Text> o lista numerada de WhatsApp/Excel.
                </Text>
              </View>

              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={8}
                placeholder={`Pegá aquí la lista de alumnos...\nEjemplo:\nPérez, Juan\nGómez, María\nRodríguez, Lucas`}
                placeholderTextColor={COLORS.secondary}
                value={textoPegado}
                onChangeText={setTextoPegado}
              />

              <TouchableOpacity style={s.ejemploBtn} onPress={pegarEjemplo} activeOpacity={0.75}>
                <Ionicons name="sparkles" size={14} color={COLORS.accent} />
                <Text style={s.ejemploBtnText}>Cargar 5 alumnos de ejemplo</Text>
              </TouchableOpacity>

              <View style={{ marginTop: SPACING.lg }}>
                <AppButton
                  label="Analizar y Previsualizar"
                  onPress={() => parsearTexto(textoPegado)}
                  disabled={!textoPegado.trim()}
                />
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Barra de control de selección */}
              <View style={s.previewControlRow}>
                <Text style={s.previewCountText}>
                  Detectados: {alumnosDetectados.length} ({cantidadSeleccionados} listos)
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={s.textBtn}
                    onPress={() => seleccionarTodos(true)}
                  >
                    <Text style={s.textBtnLabel}>Todos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.textBtn}
                    onPress={() => seleccionarTodos(false)}
                  >
                    <Text style={s.textBtnLabel}>Ninguno</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {alumnosDetectados.map((a) => (
                  <TouchableOpacity
                    key={a.idTemp}
                    style={[s.alumnoRow, a.seleccionado && s.alumnoRowSelected]}
                    onPress={() => toggleSeleccion(a.idTemp)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={a.seleccionado ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={a.seleccionado ? COLORS.accent : COLORS.secondary}
                    />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={s.alumnoNombreRow}>
                        {a.apellido ? `${a.apellido}, ${a.nombre}` : a.nombre}
                      </Text>
                      {a.dni && <Text style={s.alumnoSubRow}>DNI: {a.dni}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {importando && (
                <View style={s.progresoBox}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={s.progresoText}>
                    Inscribiendo: {progreso.actual} de {progreso.total}...
                  </Text>
                </View>
              )}

              <View style={s.actionsRow}>
                <AppButton
                  label="Volver a editar"
                  variant="outline"
                  onPress={() => setAnalizado(false)}
                  style={{ flex: 1 }}
                />
                <AppButton
                  label={importando ? 'Importando...' : `Importar (${cantidadSeleccionados})`}
                  onPress={handleEjecutarImportacion}
                  loading={importando}
                  disabled={cantidadSeleccionados === 0 || importando}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    gap: SPACING.md,
    maxHeight: '90%',
    minHeight: 480,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  subtitle: { fontSize: 11, color: COLORS.secondary },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  helpText: { flex: 1, fontSize: 11, color: COLORS.onSurface, lineHeight: 16 },
  textArea: {
    backgroundColor: '#f8f7ff',
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 13,
    color: COLORS.onSurface,
    textAlignVertical: 'top',
    minHeight: 180,
  },
  ejemploBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  ejemploBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  previewControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  previewCountText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurface },
  textBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f3f4f6', borderRadius: 6 },
  textBtnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.accent },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  alumnoRowSelected: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  alumnoNombreRow: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  alumnoSubRow: { fontSize: 10, color: COLORS.secondary },
  progresoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  progresoText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
