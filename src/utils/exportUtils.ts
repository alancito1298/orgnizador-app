import { Share, Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

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
  docenteNombre?: string;
}

/**
 * Genera y comparte el Informe Pedagógico Institucional Completo en formato PDF oficial.
 * Compatible con impresoras, WhatsApp, correo y visualizadores PDF.
 */
export async function exportarInformePedagogicoPdf(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  asistencias: Asistencia[],
  calificaciones: Calificacion[]
) {
  try {
    const fechaEmision = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const ordenados = [...inscripciones].sort((a, b) =>
      (a.alumno?.apellido || '').localeCompare(b.alumno?.apellido || '')
    );

    let totalPromedios = 0;
    let cantConPromedio = 0;
    let aprobados = 0;
    let enProceso = 0;

    const filasHtml = ordenados
      .map((insc, idx) => {
        const asis = asistencias.filter((a) => a.alumnoCursoId === insc.id);
        const presentes = asis.filter(
          (a) => a.estado === 'presente' || a.estado.startsWith('presente_')
        ).length;
        const totalAsis = asis.length;
        const pctAsis = totalAsis > 0 ? Math.round((presentes / totalAsis) * 100) : null;

        const notas = calificaciones.filter((c) => c.alumnoCursoId === insc.id);
        const notasT1 = notas
          .filter((n) => Number(n.trimestre) === 1 && Number(n.valor) > 0)
          .map((n) => Number(n.valor));
        const notasT2 = notas
          .filter((n) => Number(n.trimestre) === 2 && Number(n.valor) > 0)
          .map((n) => Number(n.valor));
        const notasT3 = notas
          .filter((n) => Number(n.trimestre) === 3 && Number(n.valor) > 0)
          .map((n) => Number(n.valor));

        const promT1 =
          notasT1.length > 0
            ? (notasT1.reduce((a, b) => a + b, 0) / notasT1.length).toFixed(1)
            : '-';
        const promT2 =
          notasT2.length > 0
            ? (notasT2.reduce((a, b) => a + b, 0) / notasT2.length).toFixed(1)
            : '-';
        const promT3 =
          notasT3.length > 0
            ? (notasT3.reduce((a, b) => a + b, 0) / notasT3.length).toFixed(1)
            : '-';

        const promsDisponibles = [promT1, promT2, promT3]
          .filter((p) => p !== '-')
          .map((p) => parseFloat(p));

        const promFinal =
          promsDisponibles.length > 0
            ? (
                promsDisponibles.reduce((a, b) => a + b, 0) /
                promsDisponibles.length
              ).toFixed(1)
            : null;

        let estadoColor = '#64748b';
        let estadoBadge = 'Sin notas';

        if (promFinal !== null) {
          const num = parseFloat(promFinal);
          totalPromedios += num;
          cantConPromedio++;
          if (num >= 7) {
            estadoColor = '#15803d';
            estadoBadge = 'Aprobado';
            aprobados++;
          } else if (num >= 6) {
            estadoColor = '#b45309';
            estadoBadge = 'Aprobado (Justo)';
            aprobados++;
          } else {
            estadoColor = '#b91c1c';
            estadoBadge = 'En Proceso';
            enProceso++;
          }
        }

        const asistenciaColor =
          pctAsis === null ? '#64748b' : pctAsis >= 75 ? '#15803d' : '#b91c1c';

        return `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="text-align: center; font-weight: bold; color: #475569;">${idx + 1}</td>
            <td style="font-weight: 600; color: #0f172a;">
              ${insc.alumno?.apellido?.toUpperCase() || ''}, ${insc.alumno?.nombre || ''}
            </td>
            <td style="text-align: center; color: #475569;">${insc.alumno?.dni || '-'}</td>
            <td style="text-align: center; font-weight: bold; color: ${asistenciaColor};">
              ${pctAsis !== null ? `${pctAsis}% (${presentes}/${totalAsis})` : '-'}
            </td>
            <td style="text-align: center;">${promT1}</td>
            <td style="text-align: center;">${promT2}</td>
            <td style="text-align: center;">${promT3}</td>
            <td style="text-align: center; font-size: 13px; font-weight: 800; color: ${
              promFinal !== null && parseFloat(promFinal) >= 6 ? '#15803d' : '#b91c1c'
            };">
              ${promFinal !== null ? promFinal : '-'}
            </td>
            <td style="text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; color: ${estadoColor}; background-color: ${estadoColor}15; border: 1px solid ${estadoColor}30;">
                ${estadoBadge}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const promedioGeneral =
      cantConPromedio > 0 ? (totalPromedios / cantConPromedio).toFixed(2) : '-';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Informe Pedagógico - ${curso.materia}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; color: #0f172a; font-size: 11px; }
          .header { background: linear-gradient(135deg, #2e1065 0%, #4c1d95 100%); color: white; padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
          .sub { font-size: 10px; opacity: 0.85; margin-top: 3px; }
          
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e2e8f0; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; }
          .meta-val { font-size: 12px; font-weight: 700; color: #1e293b; margin-top: 2px; }

          .stats-row { display: flex; gap: 12px; margin-bottom: 12px; }
          .stat-badge { flex: 1; padding: 8px 12px; border-radius: 6px; background: #ffffff; border: 1px solid #e2e8f0; text-align: center; }
          .stat-n { font-size: 14px; font-weight: 800; color: #2e1065; }
          .stat-l { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
          th { background: #2e1065; color: white; text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }

          .signatures { display: flex; justify-content: space-around; margin-top: 35px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 200px; border-top: 1px solid #475569; padding-top: 6px; font-size: 10px; font-weight: 600; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ORGANIZADOR DOCENTE — INFORME PEDAGÓGICO DE CURSO</div>
          <div class="sub">Registro Oficial de Calificaciones, Asistencias y Rendimiento Académico</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Institución</span>
            <span class="meta-val">${curso.escuela || 'Sin especificar'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Materia</span>
            <span class="meta-val">${curso.materia}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Curso / Año</span>
            <span class="meta-val">${curso.anio}° Año</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Fecha de Emisión</span>
            <span class="meta-val">${fechaEmision}</span>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-badge">
            <div class="stat-n">${inscripciones.length}</div>
            <div class="stat-l">Total de Estudiantes</div>
          </div>
          <div class="stat-badge">
            <div class="stat-n">${promedioGeneral}</div>
            <div class="stat-l">Promedio General del Curso</div>
          </div>
          <div class="stat-badge">
            <div class="stat-n" style="color: #15803d;">${aprobados}</div>
            <div class="stat-l">Alumnos Aprobados</div>
          </div>
          <div class="stat-badge">
            <div class="stat-n" style="color: ${enProceso > 0 ? '#b91c1c' : '#64748b'};">${enProceso}</div>
            <div class="stat-l">En Proceso / Pendientes</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px; text-align: center;">#</th>
              <th>Estudiante</th>
              <th style="width: 75px; text-align: center;">DNI</th>
              <th style="width: 105px; text-align: center;">Asistencia</th>
              <th style="width: 48px; text-align: center;">1° T</th>
              <th style="width: 48px; text-align: center;">2° T</th>
              <th style="width: 48px; text-align: center;">3° T</th>
              <th style="width: 55px; text-align: center;">Final</th>
              <th style="width: 95px; text-align: center;">Condición</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">Firma del Docente</div>
          <div class="sig-box">Firma del Equipo Directivo</div>
          <div class="sig-box">Sello Institucional</div>
        </div>
      </body>
      </html>
    `;

    // 1. Generar el archivo PDF localmente
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // 2. Compartir o guardar mediante el diálogo nativo
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Informe_${curso.materia}_${curso.anio}.pdf`,
      });
    } else {
      await Share.share({
        title: `Informe_${curso.materia}_${curso.anio}.pdf`,
        url: uri,
      });
    }
  } catch (err: any) {
    console.error('Error al generar PDF de informe:', err);
    Alert.alert(
      'Error',
      'No se pudo generar el PDF. Asegurate de tener una aplicación para ver o compartir archivos.'
    );
  }
}

/**
 * Genera y comparte la Planilla de Calificaciones en PDF oficial.
 */
export async function exportarCalificacionesPdf(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  calificaciones: Calificacion[]
) {
  try {
    const fechaEmision = new Date().toLocaleDateString('es-AR');
    const ordenados = [...inscripciones].sort((a, b) =>
      (a.alumno?.apellido || '').localeCompare(b.alumno?.apellido || '')
    );

    const filasHtml = ordenados
      .map((insc, idx) => {
        const notas = calificaciones.filter((c) => c.alumnoCursoId === insc.id);
        const t1 = notas
          .filter((n) => Number(n.trimestre) === 1 && Number(n.valor) > 0)
          .map((n) => n.valor)
          .join(', ') || '-';
        const t2 = notas
          .filter((n) => Number(n.trimestre) === 2 && Number(n.valor) > 0)
          .map((n) => n.valor)
          .join(', ') || '-';
        const t3 = notas
          .filter((n) => Number(n.trimestre) === 3 && Number(n.valor) > 0)
          .map((n) => n.valor)
          .join(', ') || '-';

        const todasNotas = notas.filter((n) => Number(n.valor) > 0).map((n) => Number(n.valor));
        const prom =
          todasNotas.length > 0
            ? (todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length).toFixed(1)
            : '-';

        return `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="text-align: center; font-weight: bold; color: #475569;">${idx + 1}</td>
            <td style="font-weight: 600;">${insc.alumno?.apellido?.toUpperCase() || ''}, ${insc.alumno?.nombre || ''}</td>
            <td style="text-align: center; color: #64748b;">${insc.alumno?.dni || '-'}</td>
            <td style="text-align: center;">${t1}</td>
            <td style="text-align: center;">${t2}</td>
            <td style="text-align: center;">${t3}</td>
            <td style="text-align: center; font-weight: 800; color: ${
              prom !== '-' && parseFloat(prom) >= 6 ? '#15803d' : '#b91c1c'
            }; font-size: 12px;">${prom}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Calificaciones - ${curso.materia}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; color: #0f172a; font-size: 11px; }
          .header { background: #4338ca; color: white; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; }
          .title { font-size: 15px; font-weight: bold; margin: 0; }
          .meta { font-size: 10px; opacity: 0.9; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #312e81; color: white; text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PLANILLA OFICIAL DE CALIFICACIONES</div>
          <div class="meta">Materia: ${curso.materia} | ${curso.anio}° Año | Escuela: ${curso.escuela} | Emisión: ${fechaEmision}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th>Estudiante</th>
              <th style="width: 75px; text-align: center;">DNI</th>
              <th style="width: 75px; text-align: center;">1° Trimestre</th>
              <th style="width: 75px; text-align: center;">2° Trimestre</th>
              <th style="width: 75px; text-align: center;">3° Trimestre</th>
              <th style="width: 65px; text-align: center;">Promedio</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Calificaciones_${curso.materia}_${curso.anio}.pdf`,
      });
    }
  } catch (err) {
    Alert.alert('Error', 'No se pudo generar el PDF de calificaciones.');
  }
}

/**
 * Genera y exporta la Planilla de Calificaciones en formato Excel real (.xlsx).
 * Compatible con Microsoft Excel, Google Sheets, LibreOffice y apps móviles.
 */
export async function exportarCalificacionesExcelXlsx(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  calificaciones: Calificacion[]
) {
  try {
    const ordenados = [...inscripciones].sort((a, b) =>
      (a.alumno?.apellido || '').localeCompare(b.alumno?.apellido || '')
    );

    const rows: any[][] = [];
    rows.push(['ORGANIZADOR DOCENTE — PLANILLA OFICIAL DE CALIFICACIONES']);
    rows.push([
      `Institución: ${curso.escuela || 'Sin especificar'}`,
      `Año: ${curso.anio}°`,
      `Materia: ${curso.materia}`,
      `Fecha de exportación: ${new Date().toLocaleDateString('es-AR')}`,
    ]);
    rows.push([]);
    rows.push([
      'N°',
      'Apellido y Nombre',
      'DNI',
      'Notas 1° Trimestre',
      'Notas 2° Trimestre',
      'Notas 3° Trimestre',
      'Promedio General',
      'Condición Académica',
    ]);

    ordenados.forEach((insc, idx) => {
      const notas = calificaciones.filter((c) => c.alumnoCursoId === insc.id);

      const n1 =
        notas
          .filter((c) => Number(c.trimestre) === 1 && Number(c.valor) > 0)
          .map((c) => c.valor)
          .join(' - ') || '-';
      const n2 =
        notas
          .filter((c) => Number(c.trimestre) === 2 && Number(c.valor) > 0)
          .map((c) => c.valor)
          .join(' - ') || '-';
      const n3 =
        notas
          .filter((c) => Number(c.trimestre) === 3 && Number(c.valor) > 0)
          .map((c) => c.valor)
          .join(' - ') || '-';

      const todasNotas = notas
        .filter((c) => Number(c.valor) > 0)
        .map((c) => Number(c.valor));
      const prom =
        todasNotas.length > 0
          ? (todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length).toFixed(2)
          : '-';

      const condicion =
        prom === '-'
          ? 'Sin notas'
          : parseFloat(prom) >= 7
          ? 'Aprobado'
          : parseFloat(prom) >= 6
          ? 'Aprobado (Justo)'
          : 'En Proceso';

      rows.push([
        idx + 1,
        `${insc.alumno?.apellido?.toUpperCase() || ''}, ${insc.alumno?.nombre || ''}`,
        insc.alumno?.dni || '',
        n1,
        n2,
        n3,
        prom !== '-' ? parseFloat(prom) : '-',
        condicion,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 32 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const filename = `Calificaciones_${curso.materia}_${curso.anio}.xlsx`.replace(/\s+/g, '_');
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        UTI: 'com.microsoft.excel.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: filename,
      });
    } else {
      await Share.share({ title: filename, url: fileUri });
    }
  } catch (e: any) {
    console.error('Error al exportar Excel .xlsx de calificaciones:', e);
    // Fallback limpio a CSV si el dispositivo tiene alguna restricción de almacenamiento
    exportarCalificacionesCsv(curso, inscripciones, calificaciones);
  }
}

/**
 * Genera y exporta la Sábana de Asistencias en formato Excel real (.xlsx).
 */
export async function exportarAsistenciasExcelXlsx(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  asistencias: Asistencia[]
) {
  try {
    const fechas = Array.from(
      new Set(asistencias.map((a) => a.fecha.split('T')[0]))
    ).sort();

    const ordenados = [...inscripciones].sort((a, b) =>
      (a.alumno?.apellido || '').localeCompare(b.alumno?.apellido || '')
    );

    const rows: any[][] = [];
    rows.push(['ORGANIZADOR DOCENTE — REGISTRO DE ASISTENCIAS']);
    rows.push([
      `Institución: ${curso.escuela || 'Sin especificar'}`,
      `Año: ${curso.anio}°`,
      `Materia: ${curso.materia}`,
      `Fecha de exportación: ${new Date().toLocaleDateString('es-AR')}`,
    ]);
    rows.push([]);

    // Fila de encabezados con fechas dinámicas
    const headers = ['N°', 'Apellido y Nombre', 'DNI', ...fechas, 'Total Presentes', 'Total Clases', '% Asistencia'];
    rows.push(headers);

    ordenados.forEach((insc, idx) => {
      const asisAlumno = asistencias.filter((a) => a.alumnoCursoId === insc.id);
      const presentes = asisAlumno.filter(
        (a) => a.estado === 'presente' || a.estado.startsWith('presente_')
      ).length;
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

      rows.push([
        idx + 1,
        `${insc.alumno?.apellido?.toUpperCase() || ''}, ${insc.alumno?.nombre || ''}`,
        insc.alumno?.dni || '',
        ...estadosFila,
        presentes,
        total,
        `${pct}%`,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = [{ wch: 5 }, { wch: 32 }, { wch: 14 }];
    fechas.forEach(() => colWidths.push({ wch: 12 }));
    colWidths.push({ wch: 16 }, { wch: 14 }, { wch: 14 });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const filename = `Asistencias_${curso.materia}_${curso.anio}.xlsx`.replace(/\s+/g, '_');
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        UTI: 'com.microsoft.excel.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: filename,
      });
    } else {
      await Share.share({ title: filename, url: fileUri });
    }
  } catch (e: any) {
    console.error('Error al exportar Excel .xlsx de asistencias:', e);
    exportarAsistenciasCsv(curso, inscripciones, asistencias);
  }
}

/**
 * Exporta las asistencias en formato CSV / Texto de respaldo.
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
      const presentes = asisAlumno.filter(
        (a) => a.estado === 'presente' || a.estado.startsWith('presente_')
      ).length;
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

      csv += `"${insc.alumno?.apellido}, ${insc.alumno?.nombre}";"${
        insc.alumno?.dni || ''
      }";${estadosFila.join(';')};${presentes}/${total};${pct}%\n`;
    });

    await Share.share({
      title: `Asistencias_${curso.materia}_${curso.anio}.csv`,
      message: csv,
    });
  } catch {
    Alert.alert('Error', 'No se pudo compartir el archivo de asistencias.');
  }
}

/**
 * Exporta las calificaciones en formato CSV / Texto de respaldo.
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

      const n1 =
        notasAlumno
          .filter((c) => Number(c.trimestre) === 1)
          .map((c) => c.valor)
          .join(' - ') || '-';
      const n2 =
        notasAlumno
          .filter((c) => Number(c.trimestre) === 2)
          .map((c) => c.valor)
          .join(' - ') || '-';
      const n3 =
        notasAlumno
          .filter((c) => Number(c.trimestre) === 3)
          .map((c) => c.valor)
          .join(' - ') || '-';

      const suma = notasAlumno.reduce((acc, n) => acc + Number(n.valor), 0);
      const promedio = notasAlumno.length > 0 ? (suma / notasAlumno.length).toFixed(2) : '-';

      csv += `"${insc.alumno?.apellido}, ${insc.alumno?.nombre}";"${
        insc.alumno?.dni || ''
      }";"${n1}";"${n2}";"${n3}";${promedio}\n`;
    });

    await Share.share({
      title: `Calificaciones_${curso.materia}_${curso.anio}.csv`,
      message: csv,
    });
  } catch {
    Alert.alert('Error', 'No se pudo compartir la planilla de calificaciones.');
  }
}

/**
 * Genera y comparte el Informe Pedagógico.
 */
export async function exportarInformePedagogico(
  curso: CursoInfo,
  inscripciones: Inscripcion[],
  asistencias: Asistencia[],
  calificaciones: Calificacion[]
) {
  return exportarInformePedagogicoPdf(curso, inscripciones, asistencias, calificaciones);
}
