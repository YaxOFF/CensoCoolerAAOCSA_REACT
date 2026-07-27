/* Implementación REAL del contrato contra el backend de FROG.

   Está completa asumiendo que el backend responde exactamente los tipos de ./types.ts.
   Para activarla: EXPO_PUBLIC_USE_MOCK=false y EXPO_PUBLIC_API_URL=https://…

   Si el backend responde con otra forma (otros nombres de campo, envoltorio { data: … },
   fechas en otro formato), AQUÍ es donde se adapta — con una función de mapeo por método.
   Nunca en las pantallas. */

import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { esFotoMock } from '../lib/device';
import { API_URL, ApiError, getAuthToken, request } from './client';
import type { CensoApi } from './contract';
import { ESTADOS_ENFRIADOR, TIPOS_ENFRIADOR } from './types';
import type {
  Catalogos,
  Cooler,
  CoolersPage,
  CoolersQuery,
  Enfriador,
  EstadoEnfriador,
  Foto,
  FrogRow,
  RegistroCenso,
  RegistroCensoInput,
  Reporte,
  ReporteRow,
  Resumen,
  Status,
} from './types';

/** Forma exacta que hoy responde GET /censos/resumen?ruta=… */
interface ResumenApi {
  ruta: string;
  folio: number;
  totalFrog: number;
  censados: number;
  faltantes: number;
}

/** Forma exacta que hoy responde GET /coolers/resumen?rutaIni=…
 *  Son los conteos de lo YA censado por esa ruta: tipo de registro (§5) y estado (§12.1). */
interface CoolersResumenApi {
  folio: number;
  rutaIni: string | null;
  rutaFin: string | null;
  total: number;
  tipoRegistro: { correcto: number; nuevo: number; correccion: number };
  status: { usadoDisponible: number; descompuesto: number; obsoleto: number; enPiso: number };
}

/* Las claves de `status` llegan en el mismo orden que ESTADOS_ENFRIADOR (§12.1). */
const CLAVES_ESTADO = ['usadoDisponible', 'descompuesto', 'obsoleto', 'enPiso'] as const;

function mapResumen(totales: ResumenApi | null, conteos: CoolersResumenApi | null): Resumen {
  const censados = conteos?.total ?? totales?.censados ?? 0;
  // Sin /censos/resumen no hay universo FROG: el avance se muestra contra lo censado.
  const totalFrog = totales?.totalFrog ?? censados;
  return {
    totalFrog,
    censados,
    pendientes: totales?.faltantes ?? Math.max(totalFrog - censados, 0),
    porcentaje: totalFrog ? Math.round((censados / totalFrog) * 100) : 0,
    folio: conteos?.folio ?? totales?.folio,
    porStatus: {
      CORRECTO: conteos?.tipoRegistro.correcto ?? 0,
      'CORRECCIÓN': conteos?.tipoRegistro.correccion ?? 0,
      NUEVO: conteos?.tipoRegistro.nuevo ?? 0,
    },
    porEstado: ESTADOS_ENFRIADOR.map((etiqueta, i) => ({
      etiqueta,
      total: conteos?.status[CLAVES_ESTADO[i]] ?? 0,
    })),
    // El backend todavía no agrupa por CEDIS / tipo / marca; el Dashboard los muestra vacíos.
    porCedis: [],
    porTipo: [],
    porMarcaModelo: [],
  };
}

/* El backend emite las URLs de evidencias con SU propio host (en dev, localhost),
   que desde el teléfono no resuelve. EXPO_PUBLIC_IMG_URL lo reapunta al host
   alcanzable (IP de la LAN). Sin la variable la URL se deja tal cual, que es lo
   correcto en producción y con `adb reverse`. */
const IMG_URL = process.env.EXPO_PUBLIC_IMG_URL?.replace(/\/$/, '');

function hostDeImagenes(url: string): string {
  return IMG_URL ? url.replace(/^https?:\/\/[^/]+/, IMG_URL) : url;
}

/* ── FROG → Enfriador ──────────────────────────────────────────────────────
   GET /frog/enfriadores/:serie responde un ARRAY de filas en MAYÚSCULAS. */

/* FROG manda TIPOENFRI en mayúsculas y a veces con espacios o sin acento
   ("PENAFI ", "peñafi"). Sin normalizar no empata con la opción del catálogo y el
   Select aparece vacío. Se compara sin acentos ni espacios y se devuelve la clave
   del catálogo; si no empata con ninguna, se conserva el valor tal cual llegó. */
function normalizaTipo(tipo: string | null | undefined): string {
  const limpio = (tipo ?? '').trim();
  if (!limpio) return '';
  const plano = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase();
  return TIPOS_ENFRIADOR.find((t) => plano(t) === plano(limpio)) ?? limpio.toUpperCase();
}

function mapFrog(row: FrogRow, serie: string): Enfriador {
  const direccion = [[row.CALLE, row.NUMERO].filter(Boolean).join(' '), row.COLONIA]
    .filter(Boolean)
    .join(', ');
  return {
    numeroSerie: row.SERIE?.trim() || serie,
    numeroCliente: row.IDCLIENTE ?? '',
    nombreCliente: row.RAZONSOCIAL ?? '',
    direccion,
    cedis: row.UDN ?? '',
    ruta: row.RUTA ?? '',
    marca: row.MARCA ?? '',
    modelo: row.MODELO ?? '',
    tipo: normalizaTipo(row.TIPOENFRI),
    frog: row,
  };
}

/* ── Censo → POST /coolers ─────────────────────────────────────────────────
   `status` es un enum CERRADO de strings: mandar otra cosa da 400.
   Ojo con "EN PISO": va con espacio, no con guion bajo. */

const ESTADO_A_ENUM: Record<EstadoEnfriador, string> = {
  'Usado Disponible': 'USADO_DISPONIBLE',
  Descompuesto: 'DESCOMPUESTO',
  Obsoleto: 'OBSOLETO',
  'En Piso': 'EN PISO',
};

/* §5 — el status del censo va como `tipoRegistro` (enum CoolerTipoRegistro del backend).
   Ojo: allá "CORRECCION" va SIN acento y el dominio sí lo lleva, así que el mapeo es
   obligatorio; mandar 'CORRECCIÓN' tal cual responde 400. */
const STATUS_A_TIPO_REGISTRO: Record<Status, string> = {
  CORRECTO: 'CORRECTO',
  'CORRECCIÓN': 'CORRECCION',
  NUEVO: 'NUEVO',
};

/** El enum de vuelta ("USADO_DISPONIBLE") al estado del dominio ("Usado Disponible"). */
function mapEstado(status: string): EstadoEnfriador {
  const normalizado = status.replace(/_/g, ' ').toUpperCase();
  const estados = Object.keys(ESTADO_A_ENUM) as EstadoEnfriador[];
  return estados.find((e) => e.toUpperCase() === normalizado) ?? 'Usado Disponible';
}

/** Cuerpo del POST: la fila de FROG como base, pisada por lo que editó el inspector. */
function mapAlta(input: RegistroCensoInput) {
  const frog = input.frog ?? {};
  return {
    comodato: frog.COMODATO ?? null,
    contrato: frog.CONTRATO ?? null,
    denComercial: frog.DENCOMERCIAL ?? null,
    numero: frog.NUMERO ?? null,
    colonia: frog.COLONIA ?? null,
    frec: frog.FREC ?? null,
    descripcion: frog.DESCRIPCION ?? [input.marca, input.modelo].filter(Boolean).join(' '),
    anio: frog.ANIO ?? null,
    subStatus: frog.SUBSTATUS ?? null,
    // Lo capturado en el formulario manda sobre FROG.
    serie: input.numeroSerie,
    udn: input.cedis,
    ruta: input.ruta,
    idCliente: input.numeroCliente,
    razonSocial: input.nombreCliente,
    calle: input.direccion,
    tipoEnfri: input.tipo,
    marca: input.marca || null,
    modelo: input.modelo || null,
    tipoRegistro: STATUS_A_TIPO_REGISTRO[input.status],
    observaciones: input.observaciones,
    latitud: input.lat,
    longitud: input.lng,
    status: ESTADO_A_ENUM[input.estadoEnfriador],
  };
}

/** tipoRegistro del backend ("CORRECCION", sin acento) → Status del dominio (§5). */
function mapStatus(tipoRegistro: string | null): Status | '' {
  const t = (tipoRegistro ?? '').toUpperCase();
  return (Object.keys(STATUS_A_TIPO_REGISTRO) as Status[]).find(
    (s) => STATUS_A_TIPO_REGISTRO[s] === t
  ) ?? '';
}

/** Cooler (GET /coolers) → fila del reporte corporativo (§10). */
function coolerAFila(c: Cooler): ReporteRow {
  return {
    cedis: c.udn ?? '',
    ruta: c.ruta ?? '',
    numeroCliente: c.idCliente ?? '',
    nombreCliente: c.razonSocial ?? c.denComercial ?? '',
    direccion: [[c.calle, c.numero].filter(Boolean).join(' '), c.colonia].filter(Boolean).join(', '),
    numeroSerie: c.serie,
    marca: c.marca ?? '',
    modelo: c.modelo ?? '',
    tipo: normalizaTipo(c.tipoEnfri),
    status: mapStatus(c.tipoRegistro),
    estadoEnfriador: mapEstado(c.status),
    censado: 'SI',
    observaciones: c.observaciones ?? '',
    fecha: c.created,
  };
}

/** Cooler recién creado → RegistroCenso, que es lo que consumen las pantallas. */
function mapRegistro(c: Cooler, input: RegistroCensoInput, fotos: Foto[]): RegistroCenso {
  return {
    ...input,
    numeroSerie: c.serie,
    estadoEnfriador: mapEstado(c.status),
    lat: c.latitud ?? input.lat,
    lng: c.longitud ?? input.lng,
    fecha: c.created ?? input.fecha,
    censado: 'SI',
    fotos,
  };
}

/* POST /coolers/:id/evidencias — multipart con la foto y su pie.

   No usa fetch + FormData: en Android eso falla con "Network request failed" al
   adjuntar un file:// del ImagePicker. uploadAsync arma el multipart en nativo,
   leyendo el archivo del disco, que es justo el caso de uso. El servidor
   re-codifica a JPEG ≤1600px, así que no hace falta comprimir aquí. */
async function subirEvidencia(coolerId: string, foto: Foto): Promise<Foto> {
  const token = getAuthToken();
  const res = await uploadAsync(
    `${API_URL}/coolers/${encodeURIComponent(coolerId)}/evidencias`,
    foto.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters: { pie: foto.pie ?? foto.tipo },
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  const cuerpo = res.body ? JSON.parse(res.body) : null;
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(cuerpo?.title ?? `Error ${res.status} al subir la evidencia.`, res.status, cuerpo);
  }
  // §Convenciones: la url viene ya armada con FILES_BASE_URL; solo se reapunta el host
  // cuando el teléfono no alcanza el del servidor (EXPO_PUBLIC_IMG_URL).
  return { ...foto, id: cuerpo.id, uri: hostDeImagenes(cuerpo.url) };
}

export const httpApi: CensoApi = {
  async lookupEnfriador(numeroSerie) {
    const serie = numeroSerie.trim().toUpperCase();
    try {
      const filas = await request<FrogRow[]>(`/frog/enfriadores/${encodeURIComponent(serie)}`);
      // Puede venir más de una fila por serie; se toma la primera (§4).
      return filas?.length ? mapFrog(filas[0], serie) : null;
    } catch (e) {
      // 404 no es un error de la app: significa serie inexistente => status NUEVO (§5).
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  listRegistros() {
    return request<RegistroCenso[]>('/censos');
  },

  async listCoolers({ page = 1, pageSize = 20, serie }: CoolersQuery = {}) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (serie?.trim()) qs.set('serie', serie.trim());
    const r = await request<CoolersPage>(`/coolers?${qs}`);
    return {
      ...r,
      items: r.items.map((c) => ({
        ...c,
        evidencias: c.evidencias.map((e) => ({ ...e, url: hostDeImagenes(e.url) })),
      })),
    };
  },

  async saveRegistro(input: RegistroCensoInput) {
    const cooler = await request<Cooler>('/coolers', { method: 'POST', body: mapAlta(input) });

    // Las evidencias cuelgan del cooler, así que se suben ya con su id.
    // Las fotos simuladas no se suben: no hay archivo real detrás.
    const fotos = await Promise.all(
      input.fotos.map(async (f) => {
        if (esFotoMock(f.uri) || !f.uri) return f;
        try {
          return await subirEvidencia(cooler.id, f);
        } catch (e) {
          // ponytail: el censo YA quedó guardado en el servidor; tumbarlo por una foto
          // haría que el inspector reintentara y chocara con el 409 de serie duplicada.
          // Se conserva la uri local. Si hace falta reintentar, va una cola en src/api/.
          console.warn(`No se pudo subir la evidencia ${f.tipo}:`, e);
          return f;
        }
      })
    );

    return mapRegistro(cooler, input, fotos);
  },

  async getResumen(ruta?: string) {
    // Dos fuentes: /censos/resumen da el avance contra FROG, /coolers/resumen los
    // conteos por tipo de registro y estado. Si una falla, el Dashboard muestra la otra
    // en vez de quedarse en blanco; solo se tumba si fallan las dos.
    const [totales, conteos] = await Promise.all([
      request<ResumenApi>(`/censos/resumen${ruta ? `?ruta=${encodeURIComponent(ruta)}` : ''}`).catch(
        () => null
      ),
      request<CoolersResumenApi>(
        `/coolers/resumen${ruta ? `?rutaIni=${encodeURIComponent(ruta)}` : ''}`
      ).catch(() => null),
    ]);
    if (!totales && !conteos) throw new Error('No se pudieron cargar los indicadores.');
    return mapResumen(totales, conteos);
  },

  async getReporte(): Promise<Reporte> {
    // El backend no expone /censos/reporte (404): el reporte se arma aquí paginando
    // /coolers, como hace el mock con construirReporte(). Sin endpoint que liste FROG
    // por ruta no hay pendientes (§10), así que el reporte sale solo con lo censado.
    const pageSize = 100; // tope del backend: "page size must be between 1 and 100".
    const filas: ReporteRow[] = [];
    for (let page = 1; page <= 50; page++) {
      const r = await this.listCoolers({ page, pageSize });
      filas.push(...r.items.map(coolerAFila));
      if (!r.items.length || filas.length >= r.totalCount) break;
    }
    return { filas, resumen: await this.getResumen() };
  },

  async getCatalogos() {
    // El backend todavía no expone /catalogos. Los estados del enfriador no pueden
    // faltar: sin ellos no hay Select y el censo no se puede guardar (§12.1).
    const base: Catalogos = {
      tipos: [...TIPOS_ENFRIADOR],
      estadosEnfriador: [...ESTADOS_ENFRIADOR],
      cedis: [],
      rutas: [],
      marcas: [],
    };
    try {
      return { ...base, ...(await request<Partial<Catalogos>>('/catalogos')) };
    } catch {
      return base;
    }
  },

  async resetDemo() {
    // Con backend real no se borra nada: la limpieza solo existe en la demo.
  },
};
