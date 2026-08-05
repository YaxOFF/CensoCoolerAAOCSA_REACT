/* EL CONTRATO. Todo lo que la app necesita del "backend", en un solo lugar.
   Las pantallas solo llaman a estos métodos (vía `api` de ./index).
   Hay dos implementaciones que lo cumplen: ./mock.ts y ./http.ts.

   Si agregas un método aquí, TypeScript te obliga a implementarlo en ambas. */

import type {
  Catalogos,
  CoolersPage,
  CoolersQuery,
  Enfriador,
  FrogRow,
  RegistroCenso,
  RegistroCensoInput,
  Reporte,
  ReporteArchivo,
  Resumen,
} from './types';

export interface CensoApi {
  /** Consulta FROG por número de serie. null => la serie no existe => status NUEVO.
   *  Endpoint: GET /frog/enfriadores/:numeroSerie  (404 o array vacío => null) */
  lookupEnfriador(numeroSerie: string): Promise<Enfriador | null>;

  /** Censos ya levantados, para Historial.
   *  Endpoint: GET /censos */
  listRegistros(): Promise<RegistroCenso[]>;

  /** Censos levantados, paginados y filtrables por serie y ruta. Lo consume Historial.
   *  Endpoint: GET /coolers?page=1&pageSize=20&serie=ABC&ruta=02110101 */
  listCoolers(q?: CoolersQuery): Promise<CoolersPage>;

  /** Padrón completo de FROG para una ruta. No pagina: son decenas de filas.
   *  Endpoint: POST /frog/enfriadores  body { udnIni, udnFin, rutaIni, rutaFin }
   *  Con udn del login, udnIni = udnFin = udn; sin él, rango abierto 00–99. */
  listFrog(ruta: string, udn?: string): Promise<FrogRow[]>;

  /** Rutas que FROG tiene dadas de alta en ese CEDIS. Se consulta bajo demanda
   *  (al abrir el selector de ruta), no al arrancar: son decenas por UDN.
   *  Endpoint: GET /frog/rutas/:udn  (404 => lista vacía) */
  listRutas(udn: string): Promise<string[]>;

  /** Equipos de FROG que esa ruta todavía no censa (§10), solo `items`.
   *  Endpoint: GET /coolers/faltantes?rutaIni=…&rutaFin=…&udnIni=…&udnFin=… */
  listFaltantes(ruta: string, udn?: string): Promise<FrogRow[]>;

  /** Guarda un censo y sus evidencias. Reemplaza si ya existe esa serie (§8: Censado = SI).
   *  Endpoints: POST /coolers  y luego POST /coolers/:id/evidencias por cada foto.
   *  Las evidencias cuelgan del cooler, así que solo se pueden subir DESPUÉS del alta:
   *  por eso la subida vive aquí y no en un método aparte. */
  saveRegistro(input: RegistroCensoInput): Promise<RegistroCenso>;

  /** Indicadores del Dashboard (§9). El backend los calcula por ruta del inspector.
   *  Endpoint: GET /censos/resumen?udn=…&ruta=… */
  getResumen(ruta?: string, udn?: string): Promise<Resumen>;

  /** Reporte corporativo: censados + pendientes de FROG (§10).
   *  Endpoint: GET /censos/reporte */
  getReporte(): Promise<Reporte>;

  /** Genera el reporte EN EL SERVIDOR (cruce FROG vs. censado) y devuelve la URL
   *  de descarga, no el binario. La ruta del inspector acota el rango.
   *  Endpoints: POST /reportes/coolers (PDF) | POST /reportes/coolers/excel (.xlsx) */
  generarReporte(formato: 'pdf' | 'excel', ruta: string): Promise<ReporteArchivo>;

  /** Catálogos de tipos, estados, CEDIS y rutas.
   *  Endpoint: GET /catalogos */
  getCatalogos(): Promise<Catalogos>;

  /** Solo demo: reinicia los datos locales al estado sembrado.
   *  Con backend real es un no-op (no se borra nada del servidor). */
  resetDemo(): Promise<void>;
}
