/* Modelo de dominio del censo.
   Los nombres de campo están en español a propósito: son los mismos que viajarán
   al backend real, así el swap mock → HTTP no necesita mapeo de campos. */

export type Status = 'CORRECTO' | 'CORRECCIÓN' | 'NUEVO';

/* Los estados del enfriador (§12.1) NO son un catálogo del servidor: son el enum del
   dominio, y su orden es el int que espera POST /coolers (0..3). Fuente única. */
export const ESTADOS_ENFRIADOR = [
  'Usado Disponible',
  'Descompuesto',
  'Obsoleto',
  'En Piso',
  // Se escribe sin "de" a propósito: así calza con el enum "ACTA HECHOS" del backend.
  'Acta Hechos',
] as const;

export type EstadoEnfriador = (typeof ESTADOS_ENFRIADOR)[number];

/* CEDIS (UDN). Se guarda el id en formato XX, con el cero a la izquierda: es la llave
   que consume GET /frog/rutas/:udn. El nombre es solo para mostrar. */
export const CEDIS: Record<string, string> = {
  '01': 'VILLAHERMOSA',
  '02': 'CARDENAS',
  '03': 'COMALCALCO',
  '04': 'CHOAPAS',
  '05': 'MINATITLAN',
  '06': 'OAXACA',
  '07': 'SALINA CRUZ',
  '08': 'JUCHITAN',
  '09': 'TEHUACAN',
  '10': 'TEHUACAN CORPORATIVO',
  '18': 'PICHUCALCO',
  '19': 'EMILIANO ZAPATA',
};

export const CEDIS_IDS = Object.keys(CEDIS);

/** "02" → "02 · CARDENAS". Un id fuera del catálogo se muestra tal cual. */
export function cedisLabel(id: string): string {
  return CEDIS[id] ? `${id} · ${CEDIS[id]}` : id;
}

/** Tipos de enfriador. FROG los devuelve en TIPOENFRI con estas mismas claves. */
export const TIPOS_ENFRIADOR = ['AAOCSA', 'PEÑAFI', 'BONAFO', 'DANONE'] as const;

export type Censado = 'SI' | 'NO';

/** Fila cruda de GET /frog/enfriadores/:serie, con los nombres del backend.
    Se arrastra sin tocar para devolverla intacta en el POST /coolers: trae campos
    (comodato, contrato, frec, anio…) que el modelo de dominio no modela. */
export interface FrogRow {
  COMODATO?: string | null;
  CONTRATO?: string | null;
  UDN?: string | null;
  RUTA?: string | null;
  IDCLIENTE?: string | null;
  RAZONSOCIAL?: string | null;
  DENCOMERCIAL?: string | null;
  CALLE?: string | null;
  NUMERO?: string | null;
  COLONIA?: string | null;
  FREC?: string | null;
  SERIE?: string | null;
  DESCRIPCION?: string | null;
  TIPOENFRI?: string | null;
  ANIO?: string | null;
  SUBSTATUS?: string | null;
  MARCA?: string | null;
  MODELO?: string | null;
}

/** Lo que devuelve FROG al consultar un número de serie (§4 del spec). */
export interface Enfriador {
  numeroSerie: string;
  numeroCliente: string;
  nombreCliente: string;
  direccion: string;
  cedis: string;
  ruta: string;
  marca: string;
  modelo: string;
  tipo: string;
  /** Solo con backend real: la fila original de FROG. Ausente en el mock. */
  frog?: FrogRow;
}

/** Las 3 evidencias fotográficas obligatorias (§7). */
export type TipoFoto = 'Frontal' | 'Placa' | 'Fachada';

export interface Foto {
  tipo: TipoFoto;
  /** URI local mientras no se sube; URL remota después de que saveRegistro la suba. */
  uri: string;
  /** Id que devuelve el backend al subirla. Vacío = todavía no subida. */
  id?: string;
  /** Pie de la evidencia. Sin valor se manda el tipo. */
  pie?: string;
}

/** Un censo levantado en campo. La llave es numeroSerie. */
export interface RegistroCenso extends Enfriador {
  status: Status;
  estadoEnfriador: EstadoEnfriador;
  observaciones: string;
  /** §12.3 — ubicación, fecha y usuario del levantamiento. */
  lat: number;
  lng: number;
  fecha: string; // ISO
  usuario: string;
  censado: Censado;
  fotos: Foto[];
}

/** Lo que la pantalla de formulario envía a la API. El servidor decide fecha y censado. */
export type RegistroCensoInput = Omit<RegistroCenso, 'censado'>;

/** El censo en construcción: puede estar incompleto mientras se captura. */
export interface Draft extends Enfriador {
  /** null hasta que el usuario valida en la pantalla de resultado. */
  status: Status | null;
  /** true cuando la serie no existía en FROG. */
  esNuevo: boolean;
  estadoEnfriador: EstadoEnfriador | '';
  observaciones: string;
  fotos: Foto[];
  gps: Gps | null;
}

export interface Gps {
  lat: number;
  lng: number;
  /** true cuando son coordenadas simuladas (sin permiso / emulador). */
  mock: boolean;
}

/** Indicadores del Dashboard y del encabezado del reporte (§9). */
export interface Resumen {
  totalFrog: number;
  censados: number;
  pendientes: number;
  porcentaje: number;
  /** Folio consecutivo de la ruta. Solo lo devuelve el backend real. */
  folio?: number;
  porStatus: Record<Status, number>;
  porEstado: Distribucion[];
  porCedis: Distribucion[];
  porTipo: Distribucion[];
  porMarcaModelo: Distribucion[];
}

export interface Distribucion {
  etiqueta: string;
  total: number;
}

/** Fila del reporte corporativo (§10): censados + pendientes de FROG. */
export interface ReporteRow {
  cedis: string;
  ruta: string;
  numeroCliente: string;
  nombreCliente: string;
  direccion: string;
  numeroSerie: string;
  marca: string;
  modelo: string;
  tipo: string;
  status: Status | '';
  estadoEnfriador: EstadoEnfriador | '';
  censado: Censado;
  observaciones: string;
  fecha: string;
}

export interface Reporte {
  filas: ReporteRow[];
  resumen: Resumen;
}

/** Respuesta de POST /reportes/coolers[/excel]: el archivo se queda en el servidor
 *  y lo que vuelve es la URL de descarga (pública, vive REPORTES_RETENCION_DIAS). */
export interface ReporteArchivo {
  url: string;
  folio: number;
  total: number;
  censados: number;
  noCensados: number;
  generado: string;
}

/* ── GET /coolers ─────────────────────────────────────────────────────────
   El backend expone los censos ya levantados con SUS nombres de campo y
   paginados. Es una vista distinta a RegistroCenso (más campos del cliente,
   evidencias con URL remota), así que se modela aparte en lugar de forzar el
   mapeo a RegistroCenso y perder información. */

export interface Evidencia {
  id: string;
  url: string;
  pie: string | null;
  created: string;
}

export interface Cooler {
  id: string;
  serie: string;
  folio: number;
  censoAnio: number;
  censoMes: number;
  comodato: string | null;
  contrato: string | null;
  udn: string | null;
  ruta: string | null;
  idCliente: string | null;
  razonSocial: string | null;
  denComercial: string | null;
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  frec: string | null;
  descripcion: string | null;
  tipoEnfri: string | null;
  marca: string | null;
  modelo: string | null;
  anio: string | null;
  subStatus: string | null;
  /** §5 — el status del censo serializado por el backend: CORRECTO / CORRECCION / NUEVO. */
  tipoRegistro: string | null;
  observaciones: string | null;
  latitud: number | null;
  longitud: number | null;
  status: string;
  created: string;
  evidencias: Evidencia[];
}

export interface CoolersPage {
  items: Cooler[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CoolersQuery {
  page?: number;
  pageSize?: number;
  /** Filtro por número de serie (coincidencia parcial). */
  serie?: string;
  /** Ruta del inspector. Coincidencia exacta: la ruta es un código. */
  ruta?: string;
}

/** Catálogos del sistema (§4 y §7). Hoy constantes; mañana un endpoint. */
export interface Catalogos {
  tipos: string[];
  estadosEnfriador: EstadoEnfriador[];
  cedis: string[];
  rutas: string[];
  marcas: string[];
}
