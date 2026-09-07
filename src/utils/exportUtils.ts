import { Share, Alert } from 'react-native';

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

interface CursoInfo {
  materia: string;
  anio: string;
  escuela: string;
}

/**
 * Exporta las asistencias en formato CSV / Texto y abre el diálogo para compartir o guardar.
 */
export async function exportarAsistenciasCsv(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  asistencias: Asistencia[]
) {
  try {
    const fechas = Array.from(new Set(asistencias.map((a) => a.fecha.split('T')[0]))).sort();

    let csv = `REGISTRO DE ASISTENCIAS - ${curso.materia.toUpperCase()}\n`;
    csv += `Escuela: ${curso.escuela} | Año: ${curso.anio}° | Fecha de exportación: ${new Date().toLocaleDateString()}\n\n`;
    csv += `Alumno;DNI;${fechas.join(';')};Total Presentes;% Asistencia\n`;

    inscripciones.forEach((insc) => {
      const asisAlumno = asistencias.filter((a) => a.alumnoCursoId === insc.id);
      const presentes = asisAlumno.filter((a) => a.estado === 'presente' || a.estado.startsWith('presente_')).length;
      const total = asisAlumno.length;
      const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;

      const estadosFila = fechas.map((f) => {
        const found = asisAlumno.find((a) => a.fecha.startsWith(f));
        if (!found) return '-';
        if (found.estado === 'presente' || found.estado.startsWith('presente_')) return 'P';
        if (found.estado === 'ausente') return 'A';
        if (found.estado === 'media_falta') return '1/2';
        if (found.estado === 'justificada') return 'J';
        return found.estado;
      });

      csv += `"${insc.alumno?.apellido}, ${insc.alumno?.nombre}";"${insc.alumno?.dni || ''}";${estadosFila.join(';')};${presentes}/${total};${pct}%\n`;
    });

    await Share.share({
      title: `Asistencias_${curso.materia}_${curso.anio}.csv`,
      message: csv,
    });
  } catch (e: any) {
    Alert.alert('Error', 'No se pudo compartir el archivo de asistencias.');
  }
}

/**
 * Exporta las calificaciones en formato CSV / Texto y abre el diálogo para compartir o guardar.
 */
export async function exportarCalificacionesCsv(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  calificaciones: Calificacion[]
) {
  try {
    let csv = `PLANILLA DE CALIFICACIONES - ${curso.materia.toUpperCase()}\n`;
    csv += `Escuela: ${curso.escuela} | Año: ${curso.anio}° | Fecha de exportación: ${new Date().toLocaleDateString()}\n\n`;
    csv += `Alumno;DNI;Notas 1° Trim;Notas 2° Trim;Notas 3° Trim;Promedio General\n`;

    inscripciones.forEach((insc) => {
      const notasAlumno = calificaciones.filter((c) => c.alumnoCursoId === insc.id);

      const n1 = notasAlumno.filter((c) => Number(c.trimestre) === 1).map((c) => c.valor).join(' - ') || '-';
      const n2 = notasAlumno.filter((c) => Number(c.trimestre) === 2).map((c) => c.valor).join(' - ') || '-';
      const n3 = notasAlumno.filter((c) => Number(c.trimestre) === 3).map((c) => c.valor).join(' - ') || '-';

      const suma = notasAlumno.reduce((acc, n) => acc + Number(n.valor), 0);
      const promedio = notasAlumno.length > 0 ? (suma / notasAlumno.length).toFixed(2) : '-';

      csv += `"${insc.alumno?.apellido}, ${insc.alumno?.nombre}";"${insc.alumno?.dni || ''}";"${n1}";"${n2}";"${n3}";${promedio}\n`;
    });

    await Share.share({
      title: `Calificaciones_${curso.materia}_${curso.anio}.csv`,
      message: csv,
    });
  } catch (e: any) {
    Alert.alert('Error', 'No se pudo compartir la planilla de calificaciones.');
  }
}

/**
 * Genera y comparte el Informe Pedagógico del curso completo.
 */
export async function exportarInformePedagogico(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  asistencias: Asistencia[],
  calificaciones: Calificacion[]
) {
  try {
    let doc = `========================================================\n`;
    doc += `      INFORME PEDAGÓGICO DE CURSO ESCOLAR\n`;
    doc += `========================================================\n\n`;
    doc += `Institución: ${curso.escuela}\n`;
    doc += `Materia:     ${curso.materia.toUpperCase()}\n`;
    doc += `Año/Div:     ${curso.anio}° Año\n`;
    doc += `Ciclo Lect.: 2026 - 2027\n`;
    doc += `Fecha:       ${new Date().toLocaleDateString()}\n`;
    doc += `Total Alum.: ${inscripciones.length}\n`;
    doc += `--------------------------------------------------------\n\n`;

    inscripciones.forEach((insc, idx) => {
      const asis = asistencias.filter((a) => a.alumnoCursoId === insc.id);
      const presentes = asis.filter((a) => a.estado === 'presente' || a.estado.startsWith('presente_')).length;
      const pctAsis = asis.length > 0 ? Math.round((presentes / asis.length) * 100) : null;

      const notas = calificaciones.filter((c) => c.alumnoCursoId === insc.id);
      const suma = notas.reduce((acc, n) => acc + Number(n.valor), 0);
      const prom = notas.length > 0 ? (suma / notas.length).toFixed(2) : 'Sin notas';

      doc += `${idx + 1}. ${insc.alumno?.apellido?.toUpperCase()}, ${insc.alumno?.nombre}\n`;
      if (insc.alumno?.dni) doc += `   DNI: ${insc.alumno.dni}\n`;
      doc += `   Asistencia: ${pctAsis !== null ? `${pctAsis}% (${presentes}/${asis.length} clases)` : 'Sin registros'}\n`;
      doc += `   Promedio:   ${prom}\n`;
      if (notas.length > 0) {
        const detalleNotas = notas.map((n) => `${n.tipo} (T${n.trimestre}): ${n.valor}`).join(', ');
        doc += `   Detalle:    ${detalleNotas}\n`;
      }
      doc += `--------------------------------------------------------\n`;
    });

    await Share.share({
      title: `Informe_Pedagogico_${curso.materia}.txt`,
      message: doc,
    });
  } catch {
    Alert.alert('Error', 'No se pudo compartir el informe pedagógico.');
  }
}
