# 📡 Contratos Públicos

No hay servidor en este repo: `src/api/contract.ts` define el contrato que la app espera de "algo"
— `mock.ts` (AsyncStorage) o `http.ts` (fetch real). Este documento cubre los dos: el contrato
TypeScript y los endpoints REST que `http.ts` ya llama.

## El contrato: `interface CensoApi` (`src/api/contract.ts`)

| # | Método | Firma | Endpoint real |
|---|---|---|---|
| 1 | `lookupEnfriador` | `(numeroSerie) => Promise<Enfriador \| null>` | `GET /frog/enfriadores/:serie` |
| 2 | `listRegistros` | `() => Promise<RegistroCenso[]>` | `GET /censos` |
| 3 | `listCoolers` | `(q?: CoolersQuery) => Promise<CoolersPage>` | `GET /coolers?page&pageSize&serie&ruta` |
| 4 | `listFrog` | `(ruta) => Promise<FrogRow[]>` | `POST /frog/enfriadores` |
| 5 | `listFaltantes` | `(ruta) => Promise<FrogRow[]>` | `GET /coolers/faltantes?rutaIni&rutaFin` |
| 6 | `saveRegistro` | `(input) => Promise<RegistroCenso>` | `POST /coolers` + `POST /coolers/:id/evidencias` |
| 7 | `getResumen` | `(ruta?) => Promise<Resumen>` | `GET /censos/resumen` + `GET /coolers/resumen` |
| 8 | `getReporte` | `() => Promise<Reporte>` | *(se arma paginando `/coolers`)* |
| 9 | `generarReporte` | `(formato, ruta) => Promise<ReporteArchivo>` | `POST /reportes/coolers[/excel]` |
| 10 | `getCatalogos` | `() => Promise<Catalogos>` | `GET /catalogos` *(no existe aún)* |
| 11 | `resetDemo` | `() => Promise<void>` | — (no-op en `httpApi`) |

**Regla de extensión**: si una pantalla necesita un dato nuevo del servidor, se agrega el método
aquí primero. TypeScript obliga entonces a implementarlo en `mock.ts` **y** en `http.ts` (no compila
si falta uno).

Fuera del contrato hay dos llamadas HTTP más, a propósito:

- `GET {API_URL}/health` — lo sondea NetInfo para el banner de red. Ninguna pantalla lo consume.
- `GET {UPDATE_URL}/version.json` + descarga del APK — `src/api/updates.ts`, otro servidor.

## Detalle por endpoint (implementación HTTP real)

### `GET /frog/enfriadores/:serie` — `lookupEnfriador`

- **Entrada**: serie normalizada (`trim().toUpperCase()`, URL-encoded).
- **Respuesta 200**: **un array** de `FrogRow`. Se toma la primera fila (§4).
- **Array vacío o 404** ⇒ `null` ⇒ status `NUEVO` (§5). El 404 se captura y no propaga.
- **Mapeo** (`mapFrog`): `IDCLIENTE`→`numeroCliente`, `RAZONSOCIAL`→`nombreCliente`,
  `UDN`→`cedis`, `CALLE NUMERO, COLONIA`→`direccion`; y la fila cruda queda en `frog`.

> ⚠️ **`TIPOENFRI` llega sucio** ("PENAFI ", "peñafi"). `normalizaTipo()` compara sin acentos ni
> espacios contra `TIPOS_ENFRIADOR` y devuelve la clave del catálogo. Sin eso, el `Select` de tipo
> aparece vacío aunque FROG sí haya mandado el dato.

### `GET /censos` — `listRegistros`

- **Respuesta 200**: `RegistroCenso[]`, sin mapeo.
- Lo llama `RecordsProvider` al montar la app.

> ⚠️ `[TODO: confirmar que `GET /censos` existe en el backend actual.` `http.ts` lo llama sin
> mapeo ni fallback, y ningún otro método del contrato lo usa. Si el backend no lo tiene, cada
> arranque hace una llamada que falla en silencio dentro del provider.]`

### `GET /coolers` — `listCoolers`

- **Query**: `page` (default 1), `pageSize` (default 20, **máximo 100** del backend), `serie`
  (parcial), `ruta` (exacta). Los vacíos no se mandan.
- **Respuesta 200**: `CoolersPage`.
- **Post-proceso**: a cada `evidencia.url` se le reapunta el host si hay `EXPO_PUBLIC_IMG_URL`.

### `POST /frog/enfriadores` — `listFrog`

- **Body**: `{udnIni:"00", udnFin:"99", rutaIni: ruta, rutaFin: ruta}` — la UDN va abierta porque la
  ruta ya identifica al inspector.
- **404** ⇒ lista vacía (FROG no tiene equipos en el rango; para la pantalla no es un error).

### `GET /coolers/faltantes` — `listFaltantes`

- **Query**: `rutaIni`, `rutaFin` (ambos = la ruta del inspector).
- **Respuesta 200**: `{items: FrogRow[]}` — se devuelve solo `items`.

### `POST /coolers` — `saveRegistro` (paso 1)

- **Body** (`mapAlta`): la fila de FROG como base, pisada por lo que editó el inspector.

  ```ts
  // src/api/http.ts — mapAlta()
  serie: input.numeroSerie,
  udn: input.cedis,
  ruta: input.ruta,
  idCliente: input.numeroCliente,
  razonSocial: input.nombreCliente,
  calle: input.direccion,
  tipoEnfri: input.tipo,
  tipoRegistro: STATUS_A_TIPO_REGISTRO[input.status],   // CORRECCIÓN → CORRECCION
  status: ESTADO_A_ENUM[input.estadoEnfriador],         // En Piso → "EN PISO"
  latitud: input.lat,
  longitud: input.lng,
  ```

- **Respuesta**: `Cooler` con su `id` — necesario para subir las evidencias.
- **409**: serie ya censada en la ronda vigente. El `title` del backend se muestra tal cual.
  En la sincronización de la cola offline (`src/api/offline.ts`) el 409 **no** es un fallo: quiere
  decir que el censo ya está en el servidor, así que sale de la cola y se reporta aparte como
  *"ya registrado"*. Reintentarlo eternamente solo trabaría el envío.

> ⚠️ Los dos enums son **cerrados**: `'CORRECCIÓN'` con acento o `'EN_PISO'` con guion bajo
> responden **400**. Los mapeos `STATUS_A_TIPO_REGISTRO` y `ESTADO_A_ENUM` son obligatorios, no
> cosméticos.

### `POST /coolers/:id/evidencias` — `saveRegistro` (paso 2, una por foto)

- **multipart/form-data**: campo `file` (la imagen, `image/jpeg`) + parámetro `pie`.
- **No usa `fetch` + `FormData`**: en Android eso falla con "Network request failed" al adjuntar un
  `file://` del ImagePicker. Se usa `uploadAsync` de `expo-file-system/legacy`, que arma el
  multipart en nativo.
- **Respuesta**: `{id, url}` — la `url` reemplaza la `uri` local de la foto.
- El servidor re-codifica a JPEG ≤1600px, así que la app no comprime.
- **Las fotos `mock://` no se suben** (no hay archivo detrás).
- **Si una evidencia falla**: `console.warn` y se conserva la uri local; el censo NO se tumba.

### `GET /censos/resumen` + `GET /coolers/resumen` — `getResumen`

Dos llamadas en paralelo, cada una con su `.catch(() => null)`; solo si fallan **las dos** se lanza.

| Endpoint | Aporta | Query |
|---|---|---|
| `/censos/resumen` | `totalFrog`, `censados`, `faltantes`, `folio` — el avance contra FROG | `?ruta=` |
| `/coolers/resumen` | `tipoRegistro.{correcto,nuevo,correccion}` y `status.{usadoDisponible,descompuesto,obsoleto,enPiso}` | `?rutaIni=&rutaFin=` |

> ⚠️ **`rutaIni` sin `rutaFin` significa "de esa ruta en adelante"**: hay que mandar las dos para
> acotar a una sola ruta. Y el `total` de `/coolers/resumen` incluye los `NUEVO` (que no estaban en
> FROG), así que **no sirve como "censados"** para el porcentaje de avance; solo se usa de respaldo
> si `/censos/resumen` falló.

### `getReporte` — sin endpoint propio

`/censos/reporte` **no existe** (404). `getReporte()` arma el reporte del lado del cliente
paginando `/coolers` de 100 en 100, hasta 50 páginas. Sin un endpoint que liste FROG por ruta en
ese punto, **no incluye pendientes** (§10): sale solo con lo censado.

### `POST /reportes/coolers` y `POST /reportes/coolers/excel` — `generarReporte`

- **Body**: `{udnIni:"00", udnFin:"99", rutaIni: ruta, rutaFin: ruta, folio: null}`.
- **Respuesta**: `ReporteArchivo` — **la URL del archivo, no el binario**.
- La URL sale del mismo Nginx que las fotos, así que también se le reapunta el host con
  `EXPO_PUBLIC_IMG_URL`.

### `GET /catalogos` — `getCatalogos`

No existe todavía. `http.ts` arma una base local (`TIPOS_ENFRIADOR` + `ESTADOS_ENFRIADOR`, con
`cedis`, `rutas` y `marcas` vacíos) e intenta el fetch: si responde, hace merge; si falla, devuelve
la base. **Los estados no pueden faltar**: sin ellos no hay `Select` y no se puede guardar (§12.1).

### `GET /health` — fuera del contrato

Responde `{status: "ok"}`; a `client.ts` le basta el **200**. Es el `reachabilityUrl` de NetInfo.

## Métodos del contrato que ninguna pantalla usa

| Método | Quién lo llama hoy |
|---|---|
| `listRegistros` | Solo `RecordsProvider`, cuyo `registros` solo se usa como semilla del GPS simulado |
| `getReporte` | Nadie en `app/`. Existe en ambas implementaciones y en `rules.check.ts` |

Junto con `construirReporte()`, `construirCsv()` y `COLUMNAS_REPORTE` (`src/lib/rules.ts`), son el
remanente del reporte que antes se armaba en el cliente. Siguen verificados por `npm run check`, así
que no están rotos — pero tampoco están en ningún camino de la UI.
`[TODO: decidir si se borran o si el reporte cliente vuelve como fallback cuando el servidor no
puede generar el archivo.]`

## Autenticación y autorización

- **No hay login real**: la "sesión" es la ruta capturada, persistida en `AsyncStorage`.
- **El token sí viaja**: `client.ts` arranca con `process.env.EXPO_PUBLIC_API_TOKEN` y lo manda como
  `Authorization: Bearer …` en todas las llamadas (incluidas las subidas, vía `getAuthToken()`).
  `setAuthToken(token)` lo reemplaza en caliente cuando exista auth real; el punto de integración
  es `src/store/session.tsx`.
- **401/403**: `client.ts` los traduce a `'Sesión no válida. Vuelve a ingresar tu ruta.'`.

> ⚠️ **El token del `.env` queda embebido y legible dentro del APK.** Las variables `EXPO_PUBLIC_*`
> se inlinean en el bundle al compilar: no es un secreto. Ver [07-CONFIGURACION.md](07-CONFIGURACION.md).

## Manejo de errores uniforme (`src/api/client.ts`)

Toda llamada pasa por `request<T>()`, que:

- Aplica **timeout de 15 s** con `AbortController`.
- Traduce cualquier fallo (red, timeout, HTTP no-2xx) a `ApiError` con `message`, `status` y `body`.
- Actualiza el estado de red (ver [02-ARQUITECTURA.md](02-ARQUITECTURA.md) § *Detección de red*).
- Si `EXPO_PUBLIC_API_URL` está vacía, lanza `ApiError` de inmediato sin intentar el fetch.

El backend responde **RFC 7807** (`{type, title, status, detail}`), no `{message}`. `mensajeDeError()`
busca en este orden:

1. `errors` — los 400 de validación traen el detalle campo por campo; se concatenan (el `title`
   genérico "One or more validation errors occurred." no le sirve a nadie).
2. `detail` → `message` → `title`.
3. Mensajes propios en español para 401/403, 404 y 5xx (esos vienen con body vacío).

## Validaciones del cliente

- `validarDraft()` (§7, §12.1) exige serie, `status`, `estadoEnfriador` y foto de `Placa` antes de
  `saveRegistro`. No hay validación de formato (regex, longitud): se asume server-side.
- `normalizarVersion()` (`src/lib/version.ts`) valida el `version.json` remoto — `versionCode`
  entero > 0 y `apkUrl` no vacía — antes de usarlo. Es un borde de confianza explícito.
- `construirCsv()` escapa comillas dobles y antepone BOM UTF-8 (formato, no seguridad).

## Webhooks / eventos externos

No aplica. Toda comunicación es request/response iniciado por el cliente.
