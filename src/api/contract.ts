/* EL CONTRATO. Todo lo que la app necesita del "backend", en un solo lugar.
   Las pantallas solo llaman a estos métodos (vía `api` de ./index).
   Hay dos implementaciones que lo cumplen: ./mock.ts y ./http.ts.

   Si agregas un método aquí, TypeScript te obliga a implementarlo en ambas. */

import type {
  Catalogos,
  Enfriador,
  RegistroCenso,
  RegistroCensoInput,
  Reporte,
  Resumen,
  TipoFoto,
} from './types';

export interface CensoApi {
  /** Consulta FROG por número de serie. null => la serie no existe => status NUEVO.
   *  Endpoint: GET /enfriadores/:numeroSerie  (404 => null) */
  lookupEnfriador(numeroSerie: string): Promise<Enfriador | null>;

  /** Censos ya levantados, para Historial.
   *  Endpoint: GET /censos */
  listRegistros(): Promise<RegistroCenso[]>;

  /** Guarda un censo. Reemplaza si ya existe esa serie (§8: Censado = SI).
   *  Endpoint: POST /censos */
  saveRegistro(input: RegistroCensoInput): Promise<RegistroCenso>;

  /** Indicadores del Dashboard (§9).
   *  Endpoint: GET /censos/resumen */
  getResumen(): Promise<Resumen>;

  /** Reporte corporativo: censados + pendientes de FROG (§10).
   *  Endpoint: GET /censos/reporte */
  getReporte(): Promise<Reporte>;

  /** Sube una evidencia fotográfica y devuelve su id/URL definitiva.
   *  Endpoint: POST /censos/fotos  (multipart/form-data) */
  subirFoto(uri: string, tipo: TipoFoto): Promise<{ id: string; uri: string }>;

  /** Catálogos de tipos, estados, CEDIS y rutas.
   *  Endpoint: GET /catalogos */
  getCatalogos(): Promise<Catalogos>;

  /** Solo demo: reinicia los datos locales al estado sembrado.
   *  Con backend real es un no-op (no se borra nada del servidor). */
  resetDemo(): Promise<void>;
}
