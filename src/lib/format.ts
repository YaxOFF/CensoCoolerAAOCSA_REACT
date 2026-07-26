/* Formato de presentación. Nada de reglas de negocio aquí (eso vive en rules.ts). */

/** "21 jul 10:14" — mismo formato corto que la demo. */
export function fmtFecha(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

export function fmtCoord(n: number, decimales = 5): string {
  return n.toFixed(decimales);
}

/** Guion largo para celdas vacías, como en la demo. */
export function oDash(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return s.trim() ? s : '—';
}

export function porcentaje(parte: number, total: number): number {
  return total ? Math.round((parte / total) * 100) : 0;
}
