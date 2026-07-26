# 📡 Contratos Públicos

No hay servidor propio en este repo: `src/api/contract.ts` define el contrato que la app espera de
"algo" — hoy `mock.ts` (AsyncStorage), mañana `http.ts` (fetch real). Este documento cubre ambos: el
contrato TypeScript y los endpoints REST que `http.ts` ya asume.

## El contrato: `interface CensoApi` (`src/api/contract.ts`)

| Método | Firma | Endpoint esperado | Notas |
|---|---|---|---|
| `lookupEnfriador` | `(numeroSerie: string) => Promise<Enfriador \| null>` | `GET /enfriadores/:numeroSerie` | `404` → `null` → status `NUEVO` (§5) |
| `listRegistros` | `() => Promise<RegistroCenso[]>` | `GET /censos` | Alimenta Historial |
| `saveRegistro` | `(input: RegistroCensoInput) => Promise<RegistroCenso>` | `POST /censos` | Upsert por serie (§8); el servidor decide `censado` |
| `getResumen` | `() => Promise<Resumen>` | `GET /censos/resumen` | Indicadores del Dashboard (§9) |
| `getReporte` | `() => Promise<Reporte>` | `GET /censos/reporte` | Universo completo, censados + pendientes (§10) |
| `subirFoto` | `(uri: string, tipo: TipoFoto) => Promise<{id, uri}>` | `POST /censos/fotos` (multipart) | Solo para fotos no simuladas |
| `getCatalogos` | `() => Promise<Catalogos>` | `GET /catalogos` | Tipos, estados, CEDIS, rutas, marcas |
| `resetDemo` | `() => Promise<void>` | — | Solo mock; no-op en `httpApi` |

**Regla de extensión**: si una pantalla necesita un dato nuevo del "servidor", se agrega el método
aquí primero. TypeScript obliga entonces a implementarlo tanto en `mock.ts` como en `http.ts` (no
compila si falta uno de los dos).

## Detalle por endpoint (implementación HTTP real)

### `GET /enfriadores/:numeroSerie`
- **Implementación**: `src/api/http.ts:23`.
- **Entrada**: serie normalizada (`trim().toUpperCase()`, URL-encoded).
- **Respuesta 200**: `Enfriador` (ver `04-DATOS.md`).
- **Respuesta 404**: se traduce a `null` (no es tratado como error de app — significa serie nueva).
- **Otros errores**: propagan como `ApiError`.

### `GET /censos`
- **Respuesta 200**: `RegistroCenso[]`.

### `POST /censos`
- **Body**: `RegistroCensoInput` (JSON, `Content-Type: application/json`).
- **Respuesta 200/201**: `RegistroCenso` completo (con `censado` decidido por el servidor).
- **Semántica esperada del servidor**: upsert por `numeroSerie` — reemplaza si existe, agrega si
  no (§8). El cliente confía en que el servidor implementa esto; el mock lo hace vía
  `upsertRegistro()`.

### `GET /censos/resumen`
- **Respuesta 200**: `Resumen` — si el backend no calcula agregados, se puede construir en
  `http.ts` reusando `construirResumen()` de `src/lib/rules.ts` a partir de `listRegistros()`
  (mismo patrón que usa el mock).

### `GET /censos/reporte`
- **Respuesta 200**: `Reporte` (`{filas, resumen}`) — mismo comentario que arriba: si no hay
  endpoint dedicado, `construirReporte()` lo arma del lado del cliente.

### `POST /censos/fotos` (multipart/form-data)
- **Body**: `FormData` con campos `tipo` (string) y `archivo` (binario, `image/jpeg`).
- **Respuesta 200**: `{ id: string, uri: string }` — la URL/identificador definitivo de la foto.
- **Nota de implementación**: React Native construye el objeto de archivo como
  `{ uri, name, type }` dentro del `FormData`; no se serializa a JSON ni se envía
  `Content-Type: application/json` en esta llamada (`src/api/client.ts` lo detecta vía la opción
  `form`).

### `GET /catalogos`
- **Respuesta 200**: `Catalogos`.

## Autenticación y autorización

- **Estado actual**: no hay autenticación real. La "sesión" es solo la ruta capturada en
  `src/store/session.tsx`, persistida en `AsyncStorage`. Fuera de alcance por decisión de producto
  (ver `CLAUDE.md`).
- **Mecanismo ya preparado para cuando exista**: `src/api/client.ts` expone
  `setAuthToken(token: string | null)`; cualquier llamada posterior via `request()` agrega
  `Authorization: Bearer <token>`. El punto de integración sería `src/store/session.tsx` al
  implementar login real.
- **Errores 401/403**: `client.ts` los traduce a `'Sesión no válida. Vuelve a ingresar tu ruta.'`.

## Validaciones, sanitización, rate limiting

- **Del lado del cliente**: `validarDraft()` (§12.1) exige `numeroSerie`, `status` y
  `estadoEnfriador` antes de intentar `saveRegistro`. No hay más validación de forma (regex,
  longitud) — se asume que el backend real validará server-side.
- **Sanitización de CSV**: `construirCsv()` (`src/lib/rules.ts:183`) escapa comillas dobles y
  antepone BOM UTF-8, para prevenir corrupción del archivo al abrir en Excel (no es sanitización
  de seguridad, es de formato).
- **Sanitización HTML del PDF**: `escapeHtml()` en `src/lib/export.ts:38` escapa `& < > "` antes
  de interpolar valores del reporte en el HTML que se imprime a PDF — previene que observaciones
  con esos caracteres rompan el layout.
- **Rate limiting**: no implementado; no aplica del lado del cliente. Sería responsabilidad del
  backend real.

## Manejo de errores uniforme (`src/api/client.ts`)

Toda llamada HTTP pasa por `request<T>()`, que:
- Aplica **timeout de 15s** con `AbortController`.
- Traduce **cualquier fallo** (red, timeout, HTTP no-2xx) a `ApiError` con `message`, `status` y
  `body` opcional.
- Prioriza el `message` que venga del cuerpo de la respuesta del servidor si existe.
- Da mensajes genéricos en español para 401/403, 404, 5xx y timeout.
- Si `EXPO_PUBLIC_API_URL` no está configurada, lanza `ApiError` inmediatamente sin intentar el
  fetch — evita errores de red confusos cuando simplemente falta configuración.

## Webhooks / eventos externos

No aplica. La app no escucha ni emite webhooks; toda comunicación es request/response síncrono
desde el cliente.
