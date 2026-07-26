/* §10 — exportación del reporte corporativo a Excel (CSV) y PDF.
   La construcción del CSV vive en rules.ts (es pura); aquí solo se escribe y se comparte. */

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Reporte, ReporteRow } from '../api/types';
import { fmtFecha } from './format';
import { COLUMNAS_REPORTE, construirCsv } from './rules';

function nombreArchivo(ext: string): string {
  return `censo_enfriadores_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

async function compartir(uri: string, mimeType: string, titulo: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: titulo });
}

/** CSV con BOM: Excel abre los acentos correctamente. */
export async function exportarCsv(filas: ReporteRow[]): Promise<void> {
  const archivo = new File(Paths.cache, nombreArchivo('csv'));
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(construirCsv(filas));
  await compartir(archivo.uri, 'text/csv', 'Exportar reporte a Excel');
}

/** PDF: se imprime el mismo HTML de tabla que usaba la demo. */
export async function exportarPdf(reporte: Reporte, usuario: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: htmlReporte(reporte, usuario) });
  await compartir(uri, 'application/pdf', 'Exportar reporte a PDF');
}

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function htmlReporte(reporte: Reporte, usuario: string): string {
  const { filas, resumen } = reporte;
  const celdas = (f: ReporteRow) =>
    COLUMNAS_REPORTE.map((c) => {
      const v = c.campo === 'fecha' ? (f.fecha ? fmtFecha(f.fecha) : '—') : f[c.campo];
      return `<td>${escapeHtml(v || '—')}</td>`;
    }).join('');

  return `
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1C1C1E; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #6C6C70; font-size: 11px; margin-bottom: 14px; }
  .kpis { font-size: 11px; margin-bottom: 14px; }
  .kpis b { font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #eee; font-weight: 700; }
  tr.pend td { color: #6C6C70; }
</style></head><body>
  <h1>Censo de Enfriadores — Reporte Corporativo</h1>
  <p class="meta">Generado ${escapeHtml(fmtFecha(new Date().toISOString()))} · Usuario ${escapeHtml(usuario)}</p>
  <p class="kpis">
    Total FROG <b>${resumen.totalFrog}</b> ·
    Censados <b>${resumen.censados}</b> ·
    Pendientes <b>${resumen.pendientes}</b> ·
    Avance <b>${resumen.porcentaje}%</b> ·
    Correctos <b>${resumen.porStatus.CORRECTO}</b> ·
    Correcciones <b>${resumen.porStatus['CORRECCIÓN']}</b> ·
    Nuevos <b>${resumen.porStatus.NUEVO}</b>
  </p>
  <table>
    <thead><tr>${COLUMNAS_REPORTE.map((c) => `<th>${escapeHtml(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr class="${f.censado === 'NO' ? 'pend' : ''}">${celdas(f)}</tr>`).join('')}</tbody>
  </table>
</body></html>`;
}
