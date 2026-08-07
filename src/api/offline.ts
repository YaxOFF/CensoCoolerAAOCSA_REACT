/* ═══════════════════════════════════════════════════════════════════════════
   MODO SIN INTERNET.

   Envuelve a `httpApi` para que la jornada del inspector no se detenga cuando se
   cae la red: consulta el padrón de FROG que se descargó en Inicio, encola los
   censos y los manda cuando él lo pide desde el Historial.

   Es el `queue.ts` que anticipaban CLAUDE.md y docs/02-ARQUITECTURA.md: toda la
   lógica offline vive aquí dentro, ninguna pantalla sabe de AsyncStorage ni de
   fetch. Lo puro (mapear la cola a filas, descontar faltantes) vive en
   src/lib/rules.ts para que `npm run check` lo cubra.

   Tres decisiones de producto, tomadas con el usuario:
     1. Serie que no está en el padrón descargado ⇒ se bloquea igual que en línea
        (§4). Solo cambia el mensaje.
     2. Al volver la red el modo se apaga SOLO; el envío de la cola sigue siendo
        manual, con botón. Así nadie sincroniza a media captura sin enterarse.
     3. No hay switch manual: el modo solo se ofrece cuando la red se cae.
   ═══════════════════════════════════════════════════════════════════════════ */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

import { esFotoMock } from '../lib/device';
import { faltantesSinCola, pendienteAFilaCooler, serieNormalizada } from '../lib/rules';
import { ApiError, leerEstadoRed, redConfirmada, suscribirRed } from './client';
import type { CensoApi } from './contract';
import { mapFrog } from './http';
import { ESTADOS_ENFRIADOR, TIPOS_ENFRIADOR } from './types';
import type {
  Catalogos,
  Cooler,
  CoolersPage,
  Foto,
  FrogRow,
  RegistroCenso,
  RegistroCensoInput,
  Resumen,
} from './types';

const KEY_PADRON = 'censo_offline_padron';
const KEY_COLA = 'censo_offline_cola';
const KEY_MODO = 'censo_offline_modo';

/** Copia local del padrón de la ruta. Solo la escribe precargarPadron(). */
interface Padron {
  ruta: string;
  udn: string;
  guardado: string; // ISO
  frog: FrogRow[];
  faltantes: FrogRow[];
  resumen: Resumen | null;
  catalogos: Catalogos | null;
}

/** Un censo levantado sin conexión, esperando su POST /coolers. */
interface Pendiente {
  id: string;
  input: RegistroCensoInput;
  creado: string; // ISO
  /** Motivo del último intento fallido. Se muestra en el detalle del Historial. */
  error?: string | null;
}

export interface EstadoOffline {
  /** El inspector está capturando contra la copia local. */
  modo: boolean;
  /** Censos guardados en el teléfono que todavía no llegaron al servidor. */
  pendientes: number;
  hayPadron: boolean;
  padronFecha: string | null;
  padronTotal: number;
  padronRuta: string | null;
}

export interface ResultadoPrecarga {
  ok: boolean;
  total: number;
  error?: string;
}

export interface ResultadoSync {
  enviados: number;
  /** 409: el servidor ya tenía esa serie en la ronda vigente. Cuenta como resuelto. */
  yaRegistrados: number;
  fallidos: { serie: string; error: string }[];
}

/* ── Estado observable ──────────────────────────────────────────────────────
   Mismo patrón que el estado de red de client.ts: una caché en memoria que se
   lee sincrónicamente (useSyncExternalStore exige la MISMA referencia mientras
   nada cambie) y AsyncStorage como respaldo entre arranques. */

let estado: EstadoOffline = {
  modo: false,
  pendientes: 0,
  hayPadron: false,
  padronFecha: null,
  padronTotal: 0,
  padronRuta: null,
};

const oyentes = new Set<() => void>();

function publicar(parche: Partial<EstadoOffline>) {
  const nuevo = { ...estado, ...parche };
  const cambio = (Object.keys(nuevo) as (keyof EstadoOffline)[]).some((k) => nuevo[k] !== estado[k]);
  if (!cambio) return;
  estado = nuevo;
  oyentes.forEach((f) => f());
}

export function suscribirOffline(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function leerEstadoOffline(): EstadoOffline {
  return estado;
}

/* ── Persistencia ─────────────────────────────────────────────────────────── */

async function leerJson<T>(key: string): Promise<T | null> {
  try {
    const crudo = await AsyncStorage.getItem(key);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    // JSON corrupto: se trata como "no hay nada". Reventar aquí dejaría al
    // inspector sin app en vez de sin caché.
    return null;
  }
}

/* El padrón y la cola se leen muchas veces por pantalla (cada listado, cada
   lookup): se cachean en memoria y AsyncStorage queda solo como respaldo. */
let padron: Padron | null = null;
let cola: Pendiente[] = [];

async function guardarCola(nueva: Pendiente[]) {
  cola = nueva;
  await AsyncStorage.setItem(KEY_COLA, JSON.stringify(nueva));
  publicar({ pendientes: nueva.length });
}

async function guardarPadron(nuevo: Padron) {
  padron = nuevo;
  await AsyncStorage.setItem(KEY_PADRON, JSON.stringify(nuevo));
  publicar({
    hayPadron: true,
    padronFecha: nuevo.guardado,
    padronTotal: nuevo.frog.length,
    padronRuta: nuevo.ruta,
  });
}

/** Se llama una vez al arrancar (desde ./index.ts). Sin esto el primer render
    del banner y del modal no sabrían que hay cola ni padrón. */
export async function iniciarOffline() {
  const [p, c, modo] = await Promise.all([
    leerJson<Padron>(KEY_PADRON),
    leerJson<Pendiente[]>(KEY_COLA),
    AsyncStorage.getItem(KEY_MODO).catch(() => null),
  ]);
  padron = p;
  cola = Array.isArray(c) ? c : [];
  publicar({
    // Si la app se cerró sin red, vuelve en modo offline: el inspector sigue donde iba.
    modo: modo === '1',
    pendientes: cola.length,
    hayPadron: !!p,
    padronFecha: p?.guardado ?? null,
    padronTotal: p?.frog.length ?? 0,
    padronRuta: p?.ruta ?? null,
  });
  // Si la red ya se había confirmado mientras se leía AsyncStorage, el aviso de
  // suscribirRed ya pasó de largo: hay que revisarlo aquí también.
  apagarSiVolvioLaRed();
}

/* ── Modo ─────────────────────────────────────────────────────────────────── */

export async function activarModoOffline() {
  publicar({ modo: true });
  await AsyncStorage.setItem(KEY_MODO, '1');
}

export async function desactivarModoOffline() {
  publicar({ modo: false });
  await AsyncStorage.setItem(KEY_MODO, '0');
}

/* Decisión 2: al volver la red el modo se apaga solo. La cola NO se envía sola;
   se queda esperando el botón del Historial, para que un fallo de envío no pase
   desapercibido.

   redConfirmada() es obligatorio: el 'ok' del arranque es optimista, y sin él una
   app que abre sin señal saldría del modo antes del primer sondeo. */
function apagarSiVolvioLaRed() {
  if (estado.modo && redConfirmada() && leerEstadoRed() === 'ok') desactivarModoOffline();
}

suscribirRed(apagarSiVolvioLaRed);

/* ── Precarga ─────────────────────────────────────────────────────────────── */

/* La implementación que va a la red. La fija conOffline() al construir el envoltorio,
   así las pantallas llaman a precargarPadron()/sincronizar() sin conocer a httpApi. */
let red: CensoApi | null = null;

/** Lo ÚNICO que descarga el padrón. Lo dispara solo app/(tabs)/index.tsx. */
export async function precargarPadron(ruta: string, udn: string): Promise<ResultadoPrecarga> {
  if (!red) return { ok: false, total: 0, error: 'El modo sin internet no está disponible.' };
  try {
    // El padrón es obligatorio; el resto es decorado, y si falla no vale la pena
    // tumbar la descarga completa (el Dashboard offline se degrada, nada más).
    const frog = await red.listFrog(ruta, udn || undefined);
    const [faltantes, resumen, catalogos] = await Promise.all([
      red.listFaltantes(ruta, udn || undefined).catch(() => [] as FrogRow[]),
      red.getResumen(ruta, udn || undefined).catch(() => null),
      red.getCatalogos().catch(() => null),
    ]);

    await guardarPadron({
      ruta,
      udn,
      guardado: new Date().toISOString(),
      frog,
      faltantes,
      resumen,
      catalogos,
    });
    return { ok: true, total: frog.length };
  } catch (e) {
    return {
      ok: false,
      total: padron?.frog.length ?? 0,
      error: e instanceof Error ? e.message : 'No se pudo descargar el padrón de la ruta.',
    };
  }
}

/* ── Fotos de la cola ─────────────────────────────────────────────────────── */

/* expo-image-picker deja las fotos en el directorio de CACHÉ, que Android puede
   vaciar cuando le falta espacio. Un censo encolado puede pasar horas ahí, así que
   sus evidencias se copian a documentDirectory —que el sistema no toca— y se
   borran solo después de subirlas. */
const DIR_FOTOS = documentDirectory ? `${documentDirectory}censo-pendiente/` : null;

async function resguardarFotos(id: string, fotos: Foto[]): Promise<Foto[]> {
  if (!DIR_FOTOS) return fotos;
  try {
    await makeDirectoryAsync(DIR_FOTOS, { intermediates: true });
  } catch {
    // Ya existía. makeDirectoryAsync no tiene un "si no existe".
  }
  return Promise.all(
    fotos.map(async (f, i) => {
      // Las simuladas no tienen archivo detrás; las remotas ya están a salvo.
      if (!f.uri || esFotoMock(f.uri) || !f.uri.startsWith('file://')) return f;
      const destino = `${DIR_FOTOS}${id}-${i}-${f.tipo}.jpg`;
      try {
        await copyAsync({ from: f.uri, to: destino });
        return { ...f, uri: destino };
      } catch {
        // No se pudo copiar: se conserva la uri original. Puede que sobreviva; y si
        // no, el censo se manda igual sin esa foto antes que perder el censo entero.
        return f;
      }
    })
  );
}

async function borrarFotos(p: Pendiente) {
  if (!DIR_FOTOS) return;
  await Promise.all(
    p.input.fotos
      .filter((f) => f.uri.startsWith(DIR_FOTOS))
      .map((f) => deleteAsync(f.uri, { idempotent: true }).catch(() => {}))
  );
}

/* ── Sincronización ───────────────────────────────────────────────────────── */

/** Manda la cola al servidor, uno por uno. Nada sale de la cola sin respuesta
    del servidor: o un 2xx, o el 409 que significa "ya lo tengo". */
export async function sincronizar(): Promise<ResultadoSync> {
  const res: ResultadoSync = { enviados: 0, yaRegistrados: 0, fallidos: [] };
  if (!red) return res;

  const resueltos = new Set<string>(); // ya están en el servidor
  const errores = new Map<string, string>();

  for (const p of [...cola]) {
    try {
      await red.saveRegistro(p.input);
      res.enviados++;
      resueltos.add(p.id);
      await borrarFotos(p);
    } catch (e) {
      // 409 = esa serie ya se censó en la ronda vigente (docs/05-API.md). El censo
      // está en el servidor; reintentarlo para siempre solo trabaría la cola.
      if (e instanceof ApiError && e.status === 409) {
        res.yaRegistrados++;
        resueltos.add(p.id);
        await borrarFotos(p);
        continue;
      }
      const error = e instanceof Error ? e.message : 'Error desconocido al enviar.';
      res.fallidos.push({ serie: p.input.numeroSerie, error });
      errores.set(p.id, error);
    }
  }

  // Se recalcula sobre la cola VIGENTE, no sobre la foto del inicio: enviar puede
  // tardar (van fotos), y si la red se cayó a media sincronización el inspector pudo
  // encolar otro censo. Guardar la lista vieja lo borraría.
  await guardarCola(
    cola
      .filter((p) => !resueltos.has(p.id))
      .map((p) => (errores.has(p.id) ? { ...p, error: errores.get(p.id)! } : p))
  );
  return res;
}

/* ── Lecturas contra la copia local ───────────────────────────────────────── */

function sinPadron(): never {
  throw new ApiError(
    'Sin conexión y sin datos descargados de tu ruta. Conéctate a internet y abre la pantalla de Inicio para descargarlos.',
    0
  );
}

function colaAFilas(): Cooler[] {
  // Lo último capturado primero: es lo que el inspector acaba de hacer.
  return [...cola]
    .reverse()
    .map((p) => pendienteAFilaCooler(p.input, p.id, p.creado, p.error));
}

function colaARegistros(): RegistroCenso[] {
  return cola.map((p) => ({ ...p.input, censado: 'SI' as const, pendienteEnvio: true }));
}

/* ── El envoltorio ────────────────────────────────────────────────────────── */

export function conOffline(base: CensoApi): CensoApi {
  red = base; // lo que usan precargarPadron() y sincronizar() para salir a la red
  return {
    async lookupEnfriador(numeroSerie) {
      if (!estado.modo) return base.lookupEnfriador(numeroSerie);
      if (!padron) sinPadron();

      const buscada = serieNormalizada(numeroSerie);
      const fila = padron.frog.find((f) => serieNormalizada(f.SERIE) === buscada);
      // Decisión 1: sin coincidencia se devuelve null igual que en línea, y la
      // pantalla bloquea el censo. search.tsx cambia el mensaje, no la regla.
      return fila ? mapFrog(fila, numeroSerie.trim().toUpperCase()) : null;
    },

    async listFrog(ruta, udn) {
      if (!estado.modo) return base.listFrog(ruta, udn);
      if (!padron) sinPadron();
      return padron.frog;
    },

    async listFaltantes(ruta, udn) {
      if (!estado.modo) return base.listFaltantes(ruta, udn);
      if (!padron) sinPadron();
      return faltantesSinCola(padron.faltantes, cola.map((p) => p.input.numeroSerie));
    },

    async listRutas(udn) {
      if (!estado.modo) return base.listRutas(udn);
      if (!padron) return [];
      return [...new Set(padron.frog.map((f) => f.RUTA).filter(Boolean))].sort() as string[];
    },

    async listCoolers(q = {}) {
      // El filtro por serie del Historial también tiene que aplicar a la cola: si no,
      // buscar una serie deja a la vista pendientes que no tienen nada que ver.
      const filtro = serieNormalizada(q.serie);
      const pendientes = colaAFilas().filter(
        (c) => !filtro || serieNormalizada(c.serie).includes(filtro)
      );
      if (estado.modo) {
        // Sin red lo único que hay es la cola; el paginador se apaga solo porque
        // totalCount cabe en una página.
        return {
          items: pendientes,
          page: 1,
          pageSize: q.pageSize ?? 20,
          totalCount: pendientes.length,
        } satisfies CoolersPage;
      }

      const r = await base.listCoolers(q);
      // Con red los pendientes siguen a la vista, pero solo en la primera página:
      // mezclarlos en todas rompería el conteo del paginador del servidor.
      if (!pendientes.length || (q.page ?? 1) !== 1) return r;
      return { ...r, items: [...pendientes, ...r.items] };
    },

    async listRegistros() {
      if (estado.modo) {
        if (!padron && !cola.length) sinPadron();
        return colaARegistros();
      }
      return [...colaARegistros(), ...(await base.listRegistros())];
    },

    async saveRegistro(input) {
      if (!estado.modo) return base.saveRegistro(input);

      const id = `cola-${Date.now()}-${cola.length}`;
      const creado = new Date().toISOString();
      const fotos = await resguardarFotos(id, input.fotos);
      // §8: la cola también hace upsert por serie. Censar dos veces el mismo equipo
      // sin red tiene que dejar UN pendiente, no dos que choquen entre sí al enviar.
      const serie = serieNormalizada(input.numeroSerie);
      const previo = cola.find((p) => serieNormalizada(p.input.numeroSerie) === serie);
      if (previo) await borrarFotos(previo);

      const pendiente: Pendiente = { id, input: { ...input, fotos }, creado, error: null };
      await guardarCola([...cola.filter((p) => p !== previo), pendiente]);

      return { ...pendiente.input, censado: 'SI', pendienteEnvio: true };
    },

    async getResumen(ruta, udn) {
      if (!estado.modo) return base.getResumen(ruta, udn);
      if (!padron?.resumen) sinPadron();

      // El avance se estima sumando la cola: es lo que el inspector lleva hecho hoy
      // aunque el servidor todavía no lo sepa.
      const r = padron.resumen;
      const censados = r.censados + cola.length;
      const pendientes = Math.max(r.pendientes - cola.length, 0);
      return {
        ...r,
        censados,
        pendientes,
        porcentaje: r.totalFrog ? Math.round(((r.totalFrog - pendientes) / r.totalFrog) * 100) : 0,
      };
    },

    async getCatalogos() {
      if (!estado.modo) return base.getCatalogos();
      // Sin catálogos no hay Select de estado y el censo no se puede guardar (§12.1):
      // se cae a las constantes del dominio antes que devolver listas vacías.
      return (
        padron?.catalogos ?? {
          tipos: [...TIPOS_ENFRIADOR],
          estadosEnfriador: [...ESTADOS_ENFRIADOR],
          cedis: [],
          rutas: [],
          marcas: [],
        }
      );
    },

    async getReporte() {
      if (!estado.modo) return base.getReporte();
      throw new ApiError(
        'El reporte se arma en el servidor: necesita conexión. Envía primero tus censos pendientes desde el Historial.',
        0
      );
    },

    async generarReporte(formato, ruta) {
      if (!estado.modo) return base.generarReporte(formato, ruta);
      throw new ApiError(
        'El reporte se genera en el servidor: necesita conexión. Envía primero tus censos pendientes desde el Historial.',
        0
      );
    },

    resetDemo() {
      return base.resetDemo();
    },
  };
}
