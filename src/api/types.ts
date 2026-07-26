/* Modelo de dominio del censo.
   Los nombres de campo están en español a propósito: son los mismos que viajarán
   al backend real, así el swap mock → HTTP no necesita mapeo de campos. */

export type Status = 'CORRECTO' | 'CORRECCIÓN' | 'NUEVO';

export type EstadoEnfriador = 'Usado Disponible' | 'Descompuesto' | 'Obsoleto' | 'En Piso';

export type Censado = 'SI' | 'NO';

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
}

/** Las 3 evidencias fotográficas obligatorias (§7). */
export type TipoFoto = 'Frontal' | 'Placa' | 'Fachada';

export interface Foto {
  tipo: TipoFoto;
  /** URI local mientras no se sube; URL remota después de api.subirFoto(). */
  uri: string;
  /** Id que devuelve el backend al subirla. Vacío = todavía no subida. */
  id?: string;
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

/** Catálogos del sistema (§4 y §7). Hoy constantes; mañana un endpoint. */
export interface Catalogos {
  tipos: string[];
  estadosEnfriador: EstadoEnfriador[];
  cedis: string[];
  rutas: string[];
  marcas: string[];
}
