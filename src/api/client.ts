/* Wrapper de fetch: URL base, headers, timeout y errores uniformes.
   Es el único lugar de la app donde se llama a fetch(). */

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

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      'EXPO_PUBLIC_API_URL no está configurada. Revisa tu archivo .env.',
      0
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

    if (!res.ok) {
      throw new ApiError(mensajeDeError(res.status, datos), res.status, datos);
    }
    return datos as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
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
