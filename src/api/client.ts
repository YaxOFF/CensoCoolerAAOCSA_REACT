/* Wrapper de fetch: URL base, headers, timeout y errores uniformes.
   Es el único lugar de la app donde se llama a fetch(). */

import NetInfo from '@react-native-community/netinfo';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const TIMEOUT_MS = 15000;

/** Token de sesión. Arranca con el del .env; setAuthToken lo reemplaza cuando exista auth real. */
let authToken: string | null = process.env.EXPO_PUBLIC_API_TOKEN ?? null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Para las subidas de archivos, que no pasan por request() sino por expo-file-system. */
export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** FormData para subida de archivos: no se serializa ni lleva Content-Type. */
  form?: FormData;
}

/* ── Estado de red ──────────────────────────────────────────────────────────
   Dos fuentes, porque ninguna sola alcanza:

   1. NetInfo sondea GET /health por su cuenta (cada 60s con red, cada 5s sin ella).
      Detecta la caída aunque el inspector esté parado en una pantalla sin pedir nada.
      Apuntado a NUESTRO /health y no al default de Google: lo que importa no es que
      haya internet, es que el backend del censo conteste. Un wifi de CEDIS con
      salida a internet pero sin ruta al servidor tiene que salir como "sin conexión".

   2. El propio tráfico de request(): confirma la caída al instante (sin esperar al
      siguiente sondeo) y es lo único que ve la lentitud, que NetInfo no reporta. */
export type EstadoRed = 'ok' | 'inestable' | 'sin-conexion';

/** Sobre este umbral la respuesta llegó, pero la red va arrastrando. */
const LENTO_MS = 5000;

let backendAlcanzable = true; // lo dice NetInfo (sondeo a /health)
let ultimaRespuestaLenta = false; // lo dice el tráfico real
const oyentes = new Set<() => void>();

function estadoRed(): EstadoRed {
  if (!backendAlcanzable) return 'sin-conexion';
  return ultimaRespuestaLenta ? 'inestable' : 'ok';
}

/* El 'ok' con el que arranca `backendAlcanzable` es un SUPUESTO: todavía no contestó
   nadie. Distinguirlo importa para el modo Sin Internet, que solo se puede apagar
   con una conexión comprobada, no con la optimista del arranque. */
let confirmada = false;
export function redConfirmada(): boolean {
  return confirmada;
}

let ultimoEstado = estadoRed();
function notificar(confirma = false) {
  const primeraConfirmacion = confirma && !confirmada;
  if (confirma) confirmada = true;
  const nuevo = estadoRed();
  // La primera confirmación se avisa aunque el estado derivado no haya cambiado.
  if (nuevo === ultimoEstado && !primeraConfirmacion) return;
  ultimoEstado = nuevo;
  oyentes.forEach((f) => f());
}

/** Para useSyncExternalStore: getSnapshot debe devolver siempre la misma referencia
    mientras nada cambie, por eso se lee `ultimoEstado` y no se recalcula. */
export function suscribirRed(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
export function leerEstadoRed(): EstadoRed {
  return ultimoEstado;
}

if (API_URL) {
  NetInfo.configure({
    reachabilityUrl: `${API_URL}/health`,
    // 200 basta; el body ({ status: "ok" }) no aporta nada que un 200 no diga ya.
    reachabilityTest: async (res) => res.status === 200,
    reachabilityRequestTimeout: TIMEOUT_MS,
  });

  NetInfo.addEventListener((state) => {
    // isInternetReachable arranca en null mientras corre el primer sondeo: no es
    // "no hay red", es "todavía no sé". Tratarlo como caída pintaría el banner al abrir.
    backendAlcanzable = state.isConnected !== false && state.isInternetReachable !== false;
    if (backendAlcanzable === false) ultimaRespuestaLenta = false;
    // Solo cuenta como confirmación cuando el sondeo ya dio un veredicto: mientras
    // isInternetReachable siga en null, seguimos sin saber.
    notificar(state.isInternetReachable !== null);
  });
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      'EXPO_PUBLIC_API_URL no está configurada. Revisa tu archivo .env.',
      0
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(opts.form ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });

    const texto = await res.text();
    const datos = texto ? safeJson(texto) : null;

    // Contestó: hay red. Solo la calidad está en duda.
    backendAlcanzable = true;
    ultimaRespuestaLenta = Date.now() - t0 >= LENTO_MS;
    notificar(true);

    if (!res.ok) {
      throw new ApiError(mensajeDeError(res.status, datos), res.status, datos);
    }
    return datos as T;
  } catch (e) {
    // Un ApiError aquí ya salió del bloque de arriba: el servidor respondió (4xx/5xx),
    // así que la red está bien; el problema es otro.
    if (e instanceof ApiError) throw e;
    backendAlcanzable = false;
    ultimaRespuestaLenta = false;
    notificar(true);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('El servidor no respondió a tiempo. Revisa tu conexión.', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor.', 0, e);
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

function mensajeDeError(status: number, body: unknown): string {
  // El backend responde RFC 7807 ({ type, title, status }), donde el mensaje útil
  // ("Cooler con serie 'X' ya existe…") viaja en `title` o `detail`, no en `message`.
  const b = body as Record<string, unknown> | null;

  // Los 400 de validación traen el detalle campo por campo en `errors`; el `title`
  // genérico ("One or more validation errors occurred.") no le sirve a nadie.
  const errores = b?.errors;
  if (errores && typeof errores === 'object') {
    const detalle = Object.values(errores as Record<string, string[]>)
      .flat()
      .join(' ');
    if (detalle) return detalle;
  }

  const delServidor =
    b && typeof b === 'object' ? b.detail ?? b.message ?? b.title : null;
  if (delServidor) return String(delServidor);
  // 401/403 salen con body vacío: el mensaje lo pone la app.
  if (status === 401 || status === 403) return 'Sesión no válida. Vuelve a ingresar tu ruta.';
  if (status === 404) return 'Recurso no encontrado.';
  if (status >= 500) return 'Error del servidor. Intenta de nuevo en unos minutos.';
  return `Error ${status}.`;
}
