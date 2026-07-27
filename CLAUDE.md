# Censo de Enfriadores — App móvil (Expo / React Native)

App Android para el **censo nacional de enfriadores**. Un inspector en campo escanea el número de
serie de un enfriador, la app lo consulta en **FROG** (la base corporativa), valida o corrige los
datos del cliente y del equipo, responde las preguntas del censo con evidencia fotográfica y GPS, y
guarda el registro dejándolo como `Censado = SI`.

Hoy corre con **datos simulados**. El backend real todavía no existe; toda la app está construida
para que conectarlo sea cambiar un archivo de entorno. Ver *Conectar el backend real* abajo.

## Origen

Es el port 1:1 de una demo en HTML/CSS/JS que vive en `../AppCensoEnfriadores_DEMO/`:

- `views/*.html` — las 9 pantallas, una por archivo. Cada una tiene su equivalente en `app/`.
- `data.js` — mock de FROG, replicado en `src/api/mock.ts`.
- `shared.js` — estado y helpers, replicados en `src/store/` y `src/lib/`.
- `styles.css` — lenguaje visual, traducido a `src/theme.ts` y `src/ui/index.tsx`.
- `SISTEMA DE CENSO DE ENFRIADORES.md` — **el documento funcional**. Es la fuente de verdad de las
  reglas; los comentarios del código citan sus secciones (§4, §6, §12.2…).

Cuando una regla de negocio no quede clara, se consulta ese documento antes de improvisar.

## Vocabulario del dominio

| Término | Significado |
|---|---|
| **Serie** (`numeroSerie`) | Llave única del enfriador. Todo gira alrededor de ella. |
| **FROG** | Base corporativa con los enfriadores ya asignados a clientes. |
| **CEDIS** | Centro de distribución al que pertenece el equipo. |
| **Ruta** | Identifica al inspector. Hace las veces de login (sin contraseña). |
| **Status** | `CORRECTO` / `CORRECCIÓN` / `NUEVO`. Lo decide el sistema + la validación del usuario. |
| **Estado del enfriador** | Condición física: Usado Disponible, Descompuesto, Obsoleto, En Piso. |
| **Censado** | `SI` / `NO`. Indicador principal de avance del proyecto. |
| **En Piso** | El equipo está en el CEDIS, sin cliente asignado. Dispara la regla de BODEGA. |

Los nombres de campo van **en español** (`numeroSerie`, `estadoEnfriador`, `nombreCliente`) porque
son los que viajarán al backend. No traducirlos a inglés.

## Las 7 reglas de negocio

Todas viven en **`src/lib/rules.ts`** como funciones puras, y están cubiertas por `npm run check`.
Las pantallas solo las cablean; **si una regla cambia, se cambia ahí, nunca dentro de un `.tsx`**.

1. **Status** (§5) — serie encontrada en FROG → el usuario elige `CORRECTO` o `CORRECCIÓN`; serie no
   encontrada → `NUEVO`. → `resolverStatus()`
2. **Bloqueo de campos** (§6) — `CORRECTO` deja los datos de FROG en solo lectura; `CORRECCIÓN` y
   `NUEVO` los abren. → `camposEditables()`
3. **En Piso → BODEGA** (§12.2) — al elegir "En Piso", `numeroCliente` y `nombreCliente` se fijan en
   `BODEGA` y se bloquean; al cambiar a otro estado se restaura el cliente anterior.
   → `aplicarEnPiso()`
4. **Estado obligatorio** (§12.1) — el estado del enfriador siempre está habilitado y sin él no se
   puede guardar. → `validarDraft()`
5. **Sello del levantamiento** (§12.3) — al guardar se registran GPS (automático si el usuario no lo
   capturó), fecha, hora y usuario. → `app/censo/form.tsx` + `src/lib/device.ts`
6. **Upsert por serie** (§8) — guardar reemplaza el registro previo de esa serie o lo agrega; nunca
   duplica. El registro queda con `censado: 'SI'`. → `upsertRegistro()`
7. **Universo del reporte** (§10) — el reporte incluye los censados **y** los equipos de FROG todavía
   sin censar, marcados con `Censado = NO`. → `construirReporte()`

Nota sobre el avance: **pendiente = equipo de FROG sin censo**. Los equipos `NUEVO` no descuentan
pendientes porque no estaban en FROG. (La demo HTML tenía dos cálculos distintos entre Dashboard y
Reporte; aquí se unificó en `construirResumen()`.)

## Estructura

```
app/                     Rutas (expo-router, file-based). Solo UI y cableado.
  _layout.tsx            Providers + stack + guard de sesión (sin ruta ⇒ /login)
  login.tsx              Captura de ruta
  (tabs)/                Inicio · Censar · Historial · Panel
  censo/                 result → form → done (el flujo de captura)
  report.tsx             Reporte corporativo + exportación

src/
  api/                   ← la ÚNICA capa que sabe de dónde vienen los datos
    types.ts             Modelo de dominio
    contract.ts          interface CensoApi: el contrato
    mock.ts              Implementación simulada (FROG + AsyncStorage)
    http.ts              Implementación real (fetch)
    client.ts            Wrapper de fetch: URL base, headers, timeout, errores
    index.ts             `api` = mock o http según EXPO_PUBLIC_USE_MOCK
  store/                 Context providers: session, records, draft, catalogos, resumen
  lib/                   rules.ts (negocio), device.ts (GPS/cámara), export.ts, format.ts
  ui/index.tsx           Componentes base (Card, Field, Select, Badge, StatRow, DistBars…)
  theme.ts               Colores, radios y sombra
```

### Regla dura de arquitectura

> **Las pantallas solo llaman a `api.*`.** No hay `fetch` ni datos simulados fuera de `src/api/`.

Si una pantalla necesita un dato nuevo, se agrega un método al contrato — no se llama al servidor
desde el `.tsx`.

## Conectar el backend real

1. `cp .env.example .env`
2. En `.env`: `EXPO_PUBLIC_USE_MOCK=false` y `EXPO_PUBLIC_API_URL=https://tu-backend/api`
3. `npx expo start -c` (la caché guarda las variables de entorno; hay que limpiarla)

`src/api/http.ts` ya tiene los siete métodos escritos contra estos endpoints:

| Método del contrato | Endpoint |
|---|---|
| `lookupEnfriador(serie)` | `GET /frog/enfriadores/:serie` — array; vacío o 404 ⇒ `null` ⇒ status NUEVO |
| `listRegistros()` | `GET /censos` |
| `listCoolers(q)` | `GET /coolers?page&pageSize&serie` |
| `saveRegistro(input)` | `POST /coolers` y luego `POST /coolers/:id/evidencias` por foto (multipart) |
| `getResumen()` | `GET /censos/resumen` |
| `getReporte()` | `GET /censos/reporte` |
| `getCatalogos()` | `GET /catalogos` |

Además, `GET /health` (responde `{ status: "ok" }`) es el que sondea NetInfo para el aviso de red
— ver *Detección de red* abajo. No pasa por el contrato porque ninguna pantalla lo consume.

Las evidencias cuelgan del cooler, así que solo se pueden subir **después** del alta: por eso
`saveRegistro` hace las dos llamadas y no hay un `subirFoto` en el contrato. Si falla una evidencia
el censo NO se tumba (ya está en el servidor; reintentar chocaría con el 409 de serie duplicada).

**Si el backend responde con otra forma** (otros nombres de campo, envoltorio `{ data: … }`, fechas
en otro formato): se agrega una función de mapeo **dentro de `http.ts`**, en el método que
corresponda. Nunca se adapta la pantalla al backend.

Si el backend no calcula agregados (`/censos/resumen`, `/censos/reporte`), se pueden armar en
`http.ts` desde `listRegistros()` reusando `construirResumen()` / `construirReporte()` de
`src/lib/rules.ts` — que es justo lo que hace el mock.

Para autenticación real: `setAuthToken()` de `src/api/client.ts`, llamado desde `src/store/session.tsx`.

## Detección de red

El banner de "sin conexión / red inestable" vive en `src/ui/BannerRed.tsx`, montado una vez en
`app/_layout.tsx`. El estado se calcula en `src/api/client.ts` con dos fuentes:

- **NetInfo** sondea `GET {API_URL}/health` solo (60s con red, 5s sin ella). Apunta a nuestro
  backend y no al default de Google a propósito: en un CEDIS puede haber internet y aun así no
  haber ruta al servidor del censo, y eso para el inspector es estar sin conexión.
- **El tráfico de `request()`**: confirma la caída sin esperar al siguiente sondeo, y es lo único
  que detecta lentitud (`> 5s` ⇒ `inestable`), que NetInfo no reporta.

`@react-native-community/netinfo` va pineado a **12.0.1**, la versión que trae Expo Go SDK 57
(`expo/bundledNativeModules.json`). Mismo motivo que los `overrides` de abajo: es un módulo nativo
precompilado dentro del APK de Expo Go.

Con `EXPO_PUBLIC_USE_MOCK=true` no dispara nada: el mock no pasa por `client.ts`.

## Cómo hacer cambios comunes

- **Agregar un campo al registro** → `src/api/types.ts` (`RegistroCenso`) → el input en
  `app/censo/form.tsx` → la columna en `COLUMNAS_REPORTE` de `rules.ts` si va al reporte.
- **Agregar una pantalla** → un archivo en `app/`; expo-router la registra sola. Si lleva header o
  título, se declara en `app/_layout.tsx`.
- **Agregar un dato del servidor** → método en `contract.ts` → implementarlo en `mock.ts` **y** en
  `http.ts` (TypeScript lo exige) → consumirlo en la pantalla.
- **Cambiar una regla del spec** → `src/lib/rules.ts` + su assert en `rules.check.ts`.
- **Cambiar colores o espaciado** → `src/theme.ts`; los componentes de `src/ui/` los leen de ahí.

## Convenciones

- Componentes y comentarios en español, igual que el dominio. Comentarios que expliquen **por qué**
  y citen la sección del spec; no repetir lo que el código ya dice.
- Sin librerías de UI ni de estado: Context + `StyleSheet`. La demo define su propio lenguaje visual.
- Los estados de carga y error se muestran, no se tragan: `Loading`, `Empty`, `Alert.alert`.
- `src/lib/device.ts` nunca falla: si no hay permiso de cámara o GPS, devuelve datos simulados
  marcados con `mock: true`. Las pantallas no piden permisos por su cuenta.

## Comandos

```bash
npm start              # bundler de Expo
npm run android        # abrir en el dispositivo/emulador Android conectado
npm run check          # asserts de las reglas de negocio (sin framework de test)
npm run typecheck      # tsc --noEmit
```

Desarrollo con Expo Go alcanza para todo el flujo. Para un APK instalable hace falta un dev build
con EAS (`npx eas build -p android`), que también es lo que se necesita para producción.

## No tocar: los `overrides` de package.json

```json
"overrides": {
  "react-native-reanimated": "4.5.0",
  "react-native-worklets": "0.10.0",
  "react-dom": "19.2.3"
}
```

**No subir estas versiones, no borrar el bloque, no correr `npm update` sobre ellas.** Si se quitan,
la app **crashea al arrancar en Expo Go, sin mensaje de error en JS**.

Por qué: `reanimated` y `worklets` entran como deps transitivas de `expo-router`, y su parte nativa
(`libworklets.so`) viene **compilada dentro del APK de Expo Go**. Expo Go SDK 57 trae reanimated
`4.5.0` / worklets `0.10.0`. Si npm instala un patch más nuevo (4.5.3 / 0.10.3), el JS habla con un
nativo que no coincide y el proceso muere con `SIGSEGV` en `memcpy` dentro de `libworklets.so`.
`react-dom` está pineado a la versión de `react` porque si no, cualquier `npm install` falla con
ERESOLVE.

Cómo se diagnostica si vuelve a pasar (el error **no** aparece en la consola de Metro):

```bash
adb logcat -b crash -d | grep -E "signal|libworklets"     # SIGSEGV + libworklets.so ⇒ es esto
node -p "require('./node_modules/expo/bundledNativeModules.json')['react-native-worklets']"
node -p "require('./node_modules/react-native-worklets/package.json').version"   # deben ser iguales
```

Con un dev build de EAS esto deja de importar: ahí el nativo se compila desde `node_modules`, así que
las versiones siempre coinciden. Los `overrides` existen **solo por Expo Go**.

## Fuera de alcance por ahora

Decisiones tomadas con el usuario; **no agregar sin pedirlo**:

- **Cola offline / sincronización diferida.** Hoy los censos se guardan localmente vía la capa `api`.
  Si se necesita, el cambio se contiene en `src/api/` (un `queue.ts` que envuelva a `http.ts`).
- **Autenticación con contraseña.** La ruta identifica al inspector, como en la demo.
- **Backend real.** Los endpoints de arriba son el contrato acordado, todavía no implementados.
