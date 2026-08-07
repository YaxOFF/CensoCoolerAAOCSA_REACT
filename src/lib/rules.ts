/* Reglas de negocio del censo (§5, §6, §8, §9, §10, §12 del spec funcional).

   Funciones puras: sin React, sin expo, sin fetch. Por eso se pueden ejecutar con
   `npm run check` y por eso el mock y una futura API pueden reusarlas.
   Si una regla del spec cambia, cambia AQUÍ, no en una pantalla. */

import type {
  Catalogos,
  Cooler,
  Distribucion,
  Draft,
  Enfriador,
  EstadoEnfriador,
  FrogRow,
  RegistroCenso,
  RegistroCensoInput,
  Reporte,
  ReporteRow,
  Resumen,
  Status,
} from '../api/types';

/** §12.2 — valor que se fuerza en cliente cuando el equipo está En Piso. */
export const BODEGA = 'BODEGA';

/** §5 — status según lo que respondió FROG y la validación del usuario. */
export function resolverStatus(
  existeEnFrog: boolean,
  validacion: 'ok' | 'fix' | null
): Status | null {
  if (!existeEnFrog) return 'NUEVO';
  if (validacion === 'ok') return 'CORRECTO';
  if (validacion === 'fix') return 'CORRECCIÓN';
  return null; // aún no valida
}

/** §6 — CORRECTO deja los datos de FROG bloqueados; CORRECCIÓN y NUEVO los abren. */
export function camposEditables(status: Status | null): boolean {
  return status !== 'CORRECTO';
}

/** §12.2 — En Piso fuerza cliente = BODEGA; al salir de En Piso se restaura lo anterior.
    Devuelve el parche a aplicar sobre el draft, junto con el estado previo a conservar. */
export function aplicarEnPiso(
  estado: EstadoEnfriador | '',
  actual: { numeroCliente: string; nombreCliente: string },
  previo: { numeroCliente: string; nombreCliente: string } | null
): {
  patch: { numeroCliente: string; nombreCliente: string };
  previo: { numeroCliente: string; nombreCliente: string } | null;
  bloqueado: boolean;
} {
  if (estado === 'En Piso') {
    return {
      patch: { numeroCliente: BODEGA, nombreCliente: BODEGA },
      previo: previo ?? { ...actual },
      bloqueado: true,
    };
  }
  // Volvió a un estado normal: restaura lo que había antes de En Piso, si lo hubo.
  return { patch: previo ?? actual, previo: null, bloqueado: false };
}

/** Con "Acta Hechos" no hay equipo que fotografiar: toda la evidencia es opcional. */
export function fotoOpcional(estado: EstadoEnfriador | ''): boolean {
  return estado === 'Acta Hechos';
}

/** §7 y §12.1 — el estado del enfriador es obligatorio. Devuelve el error o null. */
export function validarDraft(
  draft: Pick<Draft, 'status' | 'estadoEnfriador' | 'numeroSerie'>,
  fotos: { tipo: string; uri?: string }[] = [],
): string | null {
  if (!draft.numeroSerie.trim()) return 'El número de serie es obligatorio.';
  if (!draft.status) return 'Indica si la información recuperada es correcta.';
  if (!draft.estadoEnfriador) return 'El estado del enfriador es obligatorio.';
  // La foto de la placa es la evidencia que amarra el censo a la serie: sin ella no se guarda.
  // Excepción: con acta de hechos el equipo puede no estar accesible, así que la foto es opcional.
  if (!fotoOpcional(draft.estadoEnfriador) && !fotos.some((f) => f.tipo === 'Placa' && f.uri))
    return 'La fotografía de la placa es obligatoria.';
  return null;
}

/** §8 — guardar por número de serie: reemplaza el registro previo o lo agrega. */
export function upsertRegistro(records: RegistroCenso[], rec: RegistroCenso): RegistroCenso[] {
  const idx = records.findIndex((r) => r.numeroSerie === rec.numeroSerie);
  if (idx < 0) return [...records, rec];
  const copia = [...records];
  copia[idx] = rec;
  return copia;
}

/** La ruta del equipo en FROG contra la del login. Ambas salen de FROG (el login las
    elige de GET /frog/rutas/:udn), así que basta normalizar espacios y mayúsculas.
    Sin ruta en la sesión o sin ruta en FROG no hay nada que comparar: no se avisa. */
export function esDeOtraRuta(rutaFrog: string | null | undefined, rutaSesion: string | null): boolean {
  const frog = (rutaFrog ?? '').trim().toUpperCase();
  const sesion = (rutaSesion ?? '').trim().toUpperCase();
  return !!frog && !!sesion && frog !== sesion;
}

/* ── Cola offline (modo Sin Internet) ──────────────────────────────────────
   La mecánica (AsyncStorage, fotos, envío) vive en src/api/offline.ts; aquí solo
   las partes puras, que así quedan cubiertas por `npm run check`. */

/** FROG emite las series con prefijo `C_` y el censo usa la serie desnuda: para
    comparar una contra otra hay que quitarlo. */
export function serieNormalizada(serie: string | null | undefined): string {
  return (serie ?? '').trim().replace(/^C_/i, '').toUpperCase();
}

/** Un censo encolado, dibujado como fila del Historial.
    `status` y `tipoRegistro` van con los valores del dominio ("Usado Disponible",
    "CORRECCIÓN") y no con los enums del backend: estadoColor()/statusColor() ya
    normalizan acentos y guiones bajos, así que la fila se pinta igual. */
export function pendienteAFilaCooler(
  input: RegistroCensoInput,
  id: string,
  creado: string,
  error?: string | null
): Cooler {
  const fecha = new Date(creado);
  const frog = input.frog ?? {};
  return {
    id,
    serie: input.numeroSerie,
    // Sin servidor no hay folio ni ronda asignada: se muestran los del momento de captura.
    folio: 0,
    censoAnio: fecha.getFullYear(),
    censoMes: fecha.getMonth() + 1,
    comodato: frog.COMODATO ?? null,
    contrato: frog.CONTRATO ?? null,
    udn: input.cedis,
    ruta: input.ruta,
    idCliente: input.numeroCliente,
    razonSocial: input.nombreCliente,
    denComercial: frog.DENCOMERCIAL ?? null,
    calle: input.direccion,
    numero: null,
    colonia: null,
    frec: frog.FREC ?? null,
    descripcion: frog.DESCRIPCION ?? `${input.marca} ${input.modelo}`.trim(),
    tipoEnfri: input.tipo,
    marca: input.marca || null,
    modelo: input.modelo || null,
    anio: frog.ANIO ?? null,
    subStatus: frog.SUBSTATUS ?? null,
    tipoRegistro: input.status,
    observaciones: input.observaciones,
    latitud: input.lat,
    longitud: input.lng,
    status: input.estadoEnfriador,
    created: input.fecha || creado,
    // Las fotos siguen en el teléfono: la uri local hace de url hasta que se suban.
    evidencias: input.fotos.map((f, i) => ({
      id: `${id}-${i}`,
      url: f.uri,
      pie: f.pie ?? f.tipo,
      created: creado,
    })),
    pendienteEnvio: true,
    errorEnvio: error ?? null,
  };
}

/** §10 sin conexión: lo que FROG marcaba como faltante, menos lo que ya se censó
    en el teléfono y todavía no se ha podido enviar. */
export function faltantesSinCola(faltantes: FrogRow[], seriesEnCola: string[]): FrogRow[] {
  const censadas = new Set(seriesEnCola.map(serieNormalizada));
  return faltantes.filter((f) => !censadas.has(serieNormalizada(f.SERIE)));
}

/** Cuenta ocurrencias de una clave dentro de una lista. */
export function contar<T>(items: T[], key: (x: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, x) => {
    const k = key(x);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/** Distribución con las categorías del catálogo primero, más las que aparezcan en los datos. */
export function distribucion<T>(items: T[], key: (x: T) => string, base: string[] = []): Distribucion[] {
  const cuenta = contar(items, key);
  const etiquetas = [...new Set([...base, ...Object.keys(cuenta)])].filter(Boolean);
  return etiquetas.map((etiqueta) => ({ etiqueta, total: cuenta[etiqueta] || 0 }));
}

/** §9 — indicadores del Dashboard.
    Pendiente = equipo que existe en FROG y todavía no tiene censo. Los NUEVOS no
    descuentan pendientes porque no estaban en FROG. */
export function construirResumen(
  records: RegistroCenso[],
  frog: Enfriador[],
  catalogos: Catalogos
): Resumen {
  const censadas = new Set(records.map((r) => r.numeroSerie));
  const pendientes = frog.filter((f) => !censadas.has(f.numeroSerie)).length;
  const totalFrog = frog.length;
  const porStatus = contar(records, (r) => r.status);

  return {
    totalFrog,
    censados: records.length,
    pendientes,
    porcentaje: totalFrog ? Math.round(((totalFrog - pendientes) / totalFrog) * 100) : 0,
    porStatus: {
      CORRECTO: porStatus['CORRECTO'] || 0,
      CORRECCIÓN: porStatus['CORRECCIÓN'] || 0,
      NUEVO: porStatus['NUEVO'] || 0,
    },
    porEstado: distribucion(records, (r) => r.estadoEnfriador, catalogos.estadosEnfriador),
    porCedis: distribucion(records, (r) => r.cedis, catalogos.cedis),
    porTipo: distribucion(records, (r) => r.tipo, catalogos.tipos),
    porMarcaModelo: distribucion(records, (r) => `${r.marca} ${r.modelo}`.trim()).sort(
      (a, b) => b.total - a.total
    ),
  };
}

/** §10 — el reporte cubre el universo completo: censados + pendientes de FROG (Censado = NO). */
export function construirReporte(
  records: RegistroCenso[],
  frog: Enfriador[],
  catalogos: Catalogos
): Reporte {
  const censadas = new Set(records.map((r) => r.numeroSerie));
  const pendientes: ReporteRow[] = frog
    .filter((f) => !censadas.has(f.numeroSerie))
    .map((f) => ({ ...f, status: '', estadoEnfriador: '', observaciones: '', censado: 'NO', fecha: '' }));

  const censadosRows: ReporteRow[] = records.map((r) => ({
    cedis: r.cedis,
    ruta: r.ruta,
    numeroCliente: r.numeroCliente,
    nombreCliente: r.nombreCliente,
    direccion: r.direccion,
    numeroSerie: r.numeroSerie,
    marca: r.marca,
    modelo: r.modelo,
    tipo: r.tipo,
    status: r.status,
    estadoEnfriador: r.estadoEnfriador,
    censado: r.censado,
    observaciones: r.observaciones,
    fecha: r.fecha,
  }));

  const filas = [...censadosRows, ...pendientes].sort(
    (a, b) =>
      (a.cedis || '').localeCompare(b.cedis || '') ||
      (a.censado === b.censado ? 0 : a.censado === 'NO' ? 1 : -1) ||
      (b.fecha || '').localeCompare(a.fecha || '')
  );

  return { filas, resumen: construirResumen(records, frog, catalogos) };
}

/** Columnas del reporte corporativo (§10). Se usan en la tabla, el CSV y el PDF. */
export const COLUMNAS_REPORTE: { titulo: string; campo: keyof ReporteRow }[] = [
  { titulo: 'CEDIS', campo: 'cedis' },
  { titulo: 'Ruta', campo: 'ruta' },
  { titulo: 'N° Cliente', campo: 'numeroCliente' },
  { titulo: 'Nombre', campo: 'nombreCliente' },
  { titulo: 'Dirección', campo: 'direccion' },
  { titulo: 'N° Serie', campo: 'numeroSerie' },
  { titulo: 'Marca', campo: 'marca' },
  { titulo: 'Modelo', campo: 'modelo' },
  { titulo: 'Tipo', campo: 'tipo' },
  { titulo: 'Status', campo: 'status' },
  { titulo: 'Estado enfriador', campo: 'estadoEnfriador' },
  { titulo: 'Censado', campo: 'censado' },
  { titulo: 'Observaciones', campo: 'observaciones' },
  { titulo: 'Fecha censo', campo: 'fecha' },
];

/** CSV con BOM para que Excel respete los acentos (igual que la demo). */
export function construirCsv(filas: ReporteRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = COLUMNAS_REPORTE.map((c) => esc(c.titulo)).join(',');
  const body = filas.map((f) => COLUMNAS_REPORTE.map((c) => esc(f[c.campo])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}
