# Censo de Enfriadores — App móvil (Expo / React Native)

App Android para el **censo nacional de enfriadores**. Un inspector en campo escanea el número de
serie de un enfriador, la app lo consulta en **FROG** (la base corporativa), valida o corrige los
datos del cliente y del equipo, responde las preguntas del censo con evidencia fotográfica y GPS, y
guarda el registro dejándolo como `Censado = SI`.

Hoy corre con **datos simulados**. El backend real todavía no existe; toda la app está construida
para que conectarlo sea cambiar un archivo de entorno. Ver *Conectar el backend real* abajo.

> **Nota de estado (2026-08-05):** el backend **sí existe** ya, y `src/api/http.ts` está escrito
> contra sus endpoints reales (coolers, evidencias, reportes generados en el servidor). Lo que
> sigue en este archivo describe el contrato y los gotchas acordados y sigue siendo válido; la
> sección *Fuera de alcance* de abajo es la que quedó parcialmente atrás. Detalle actualizado
> endpoint por endpoint en `/docs/05-API.md`.

## Instrucciones para Claude

**Antes de buscar en el código o hacer suposiciones, consulta siempre la documentación en `/docs`.**

- Para entender la arquitectura y las capas, lee `/docs/02-ARQUITECTURA.md`.
- Para el árbol de carpetas y los archivos clave, `/docs/01-ESTRUCTURA.md`.
- Para el estado global (session, records, draft, catálogos, resumen), `/docs/02-ARQUITECTURA.md`
  y `/docs/01-ESTRUCTURA.md`.
- Para los endpoints reales, sus mapeos y sus gotchas, `/docs/05-API.md`.
- Para el modelo de datos y las dos nomenclaturas de color, `/docs/04-DATOS.md`.
- Para configuración y variables de entorno, `/docs/07-CONFIGURACION.md`.
- Para compilar y publicar una versión, `/docs/11-BUILD-Y-ACTUALIZACIONES.md` y `COMPILAR.md`.
- Si necesitas ayuda rápida, comienza por `/docs/README.md`.

`/docs` es la fuente de verdad de **arquitectura** (generada leyendo el código real; los `[TODO]`
marcan huecos no confirmados). Úsala para responder preguntas, generar código coherente con la
arquitectura existente, y evitar releer todo el repo desde cero cada sesión. Las **reglas de
negocio** siguen viviendo en este archivo y en `src/lib/rules.ts`.

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

### Ojo con `status` del backend

`GET /coolers` usa dos campos que la app dibuja con **dos nomenclaturas de color distintas**:

- `tipoRegistro` — `CORRECTO` / `CORRECCION` / `NUEVO`. Es el **status del registro** (§5).
- `status` — `USADO_DISPONIBLE` / `DESCOMPUESTO` / `OBSOLETO` / `EN_PISO`. Es el **estado físico**
  del enfriador (§12.1), no el status del registro. El nombre engaña; no confundirlos.

## Nomenclatura de colores

Dos dimensiones distintas, dos paletas. Ambas viven en `src/theme.ts` y se usan en Dashboard,
Historial y donde haga falta — **no inventar colores nuevos en un `.tsx`**.

**Status del registro** → `statusColor(tipoRegistro)`

| Valor | Color |
|---|---|
| `CORRECTO` | verde (`colors.green`) |
| `CORRECCIÓN` / `CORRECCION` | ámbar (`colors.amber`) |
| `NUEVO` | morado (`colors.purple`) |

**Estado del enfriador** → `estadoColor(status)` + `estadoLabel(status)` para el texto

| Valor | Color | Lectura |
|---|---|---|
| `USADO_DISPONIBLE` | azul (`colors.blue`) | operativo |
| `DESCOMPUESTO` | rojo (`colors.red`) | falla |
| `OBSOLETO` | gris (`colors.text2`) | fuera de uso |
| `EN_PISO` | ámbar (`colors.amber`) | en CEDIS, sin cliente |

Ambos helpers normalizan acentos, mayúsculas y espacios vs. `_`, así que aceptan tanto la forma del
backend (`CORRECCION`, `USADO_DISPONIBLE`) como la de la app (`CORRECCIÓN`, `Usado Disponible`).
Valor desconocido ⇒ gris, nunca truena.

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
  lib/                   rules.ts (negocio), device.ts (GPS/cámara), format.ts
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
| `generarReporte(formato, ruta)` | `POST /reportes/coolers` (PDF) y `/reportes/coolers/excel` — body `{udnIni:"00",udnFin:"99",rutaIni,rutaFin,folio:null}`; responde la **URL** del archivo, no el binario |

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

Desarrollo con Expo Go alcanza para todo el flujo.

## Compilar el APK

**No se usa EAS.** El APK se compila localmente con Gradle. El procedimiento completo —requisitos,
firma, qué recompilar según lo que cambiaste, cómo subir versión— está en **`COMPILAR.md`**; eso es
la fuente de verdad. Resumen:

```bash
npm install
npx expo prebuild --platform android              # genera android/ desde app.json
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
cd android && JAVA_HOME=~/jdks/jdk-17.0.13+11 ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk  (~126 MB)
```

Tres cosas que hay que tener presentes al compilar:

- **`android/` no está en git** y es desechable: la genera `prebuild` desde `app.json`. Nunca edites
  `android/app/build.gradle` ni el manifest a mano — el siguiente `prebuild` los pisa. Lo que se
  toca es `app.json`. (Excepción: la config de firma, que hoy no existe; ver `COMPILAR.md` §4.)
- **JDK 17 obligatorio.** Con el Java del sistema (25) el build truena.
- **`.env` se embebe en el bundle al compilar.** Revisa `EXPO_PUBLIC_API_URL` y
  `EXPO_PUBLIC_USE_MOCK=false` *antes* de correr Gradle, no después. Y el token que va ahí queda
  legible dentro del APK: no es un secreto.

El APK sale firmado con el `debug.keystore` que genera el template de Expo. Alcanza para instalar
por USB o repartir el archivo; no sirve para Play Store. Keystore propio: pendiente.

## No tocar: los `overrides` de package.json

```json
"overrides": {
  "react-native-reanimated": "4.5.1",
  "react-native-worklets": "0.10.1",
  "react-dom": "19.2.3"
}
```

**Estado: FUNCIONA (verificado 2026-08-05 en Samsung SM-… `R5CNC1C02MK`, Expo Go 57.0.3 / versionCode
443). No tocar mientras siga funcionando: no borrar el bloque, no correr `npm update`, no
"actualizar por actualizar".**

Estos dos números **no son fijos**: tienen que ser exactamente los de la **build de Expo Go instalada
en el teléfono**. Si Expo Go se actualiza y estos quedan atrás, la app vuelve a crashear. La regla es
*seguir a Expo Go*, no *quedarse quieto*.

Por qué: `reanimated` y `worklets` entran como deps transitivas de `expo-router`, y su parte nativa
(`libworklets.so`) viene **compilada dentro del APK de Expo Go**. Si el JS y ese nativo no son la
misma versión — en cualquier dirección, más nuevo o más viejo — el proceso muere con `SIGSEGV`, sin
error en JS ni en la consola de Metro.

`react-dom` está pineado a la versión de `react` porque si no, cualquier `npm install` falla con
ERESOLVE.

Con un dev build de EAS esto deja de importar: ahí el nativo se compila desde `node_modules`, así que
las versiones siempre coinciden. Los `overrides` existen **solo por Expo Go**.

### Si vuelve a crashear al arrancar: receta exacta

Caso real 2026-08-05: `npm start` + abrir en el teléfono ⇒ la app se cierra sola ~0.5 s después de
cargar el bundle. Metro dice `Android Bundled ... OK`. **Cero errores en JS.** Causa: los overrides
estaban en `4.5.0` / `0.10.0` y el Expo Go del teléfono ya traía `0.10.1`.

**1. Confirmar que es esto** (30 s):

```bash
adb logcat -b crash -d | grep -E "signal 11|libworklets"
```

Firma exacta del bug — si ves esto, es esto y nada más:

```text
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0xf0000000000008
name: mqt_v_js  >>> host.exp.exponent <<<
#02 pc 00000000000969b4 ... libworklets.so
```

**2. Averiguar qué versión quiere Expo Go.** `bundledNativeModules.json` **NO es la fuente de
verdad** — mintió en este caso (decía `0.10.0` cuando el APK ya traía `0.10.1`). El proyecto de
control sí lo es:

```bash
cd /tmp && rm -rf ctrl
npx create-expo-app@latest ctrl --template default --no-install && cd ctrl && npm install
node -p "require('./node_modules/react-native-worklets/package.json').version"    # ⇒ la buena
node -p "require('./node_modules/react-native-reanimated/package.json').version"  # ⇒ la buena
npx expo start --port 8084     # abrirlo en el teléfono: si NO crashea, esas versiones son las correctas
```

**3. Aplicar** — poner esos dos números en `overrides` de `package.json`, y:

```bash
npm install
npx expo start -c              # -c obligatorio: la caché de Metro guarda el bundle viejo
```

**4. Verificar en el teléfono** sin tocarlo con la mano:

```bash
adb logcat -c
adb shell am force-stop host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d "exp://$(ip route get 1.1.1.1 | grep -oP 'src \K\S+'):8081" host.exp.exponent
sleep 45
adb logcat -b crash -d | grep -c "signal 11"    # tiene que dar 0
adb exec-out screencap -p > /tmp/shot.png       # tiene que verse la pantalla de login
```

Comandos de apoyo, por si hacen falta:

```bash
adb shell dumpsys package host.exp.exponent | grep -E "versionName|versionCode"  # build de Expo Go
adb logcat -b main -d | grep ReactNativeJS | grep -v 'Running .main'             # errores JS reales
fuser -k 8081/tcp                                                                # matar un Metro colgado
```

**Callejones sin salida ya recorridos** (no repetirlos):

- `bundledNativeModules.json` de `expo` — desactualizado respecto al APK, no sirve para decidir.
- Copias anidadas de `worklets`/`reanimated` en `node_modules` — no había, los `overrides` funcionan.
- Falta de `babel.config.js` — el proyecto nunca lo tuvo; `babel-preset-expo` entra por default.
- `npx expo-doctor` — reporta patches atrasados, `expo-font` faltante y props inválidas en
  `app.json`. Todo real, pero **nada de eso causa este crash**.
- Symbolizar `libworklets.so` con `nm`/`addr2line` — viene stripped, no da nada útil.

## Auto-actualización del APK

La app se reparte fuera de Play Store, así que se actualiza sola contra un Nginx propio:
`EXPO_PUBLIC_UPDATE_URL` (default `https://files.censo.aaocsa.com/app-release`).

- `src/api/updates.ts` — lee `version.json`, compara contra `Application.nativeBuildVersion`
  (el `versionCode`), descarga el APK a la caché y lo abre con el instalador del sistema.
- `src/ui/ModalActualizacion.tsx` — el aviso, con changelog, progreso y reintento. Montado una
  sola vez en `app/_layout.tsx`, como `BannerRed`. Con `forceUpdate: true` no se puede cerrar.

`version.json` que sirve el Nginx:

```json
{
  "versionCode": 2,
  "versionName": "1.0.1",
  "apkUrl": "CensoCooler-1.0.1.apk",
  "whatsNew": "• Arregla el guardado sin GPS.\n• Reporte más rápido.",
  "forceUpdate": false
}
```

`apkUrl` relativa se resuelve contra `EXPO_PUBLIC_UPDATE_URL`. Manda `versionCode`, no
`versionName`. Publicar versión nueva: ver *Subir versión* en `COMPILAR.md`.

**No se usa `react-native-update-apk`**: sin config plugin, obligaría a editar `android/` a mano y
`prebuild` lo pisa. `expo-file-system` ya trae descarga con progreso **y** su propio FileProvider
(`${applicationId}.FileSystemFileProvider`, con `cache-path`), y `expo-intent-launcher` lanza el
`INSTALL_PACKAGE`. El único cambio nativo es `android.permissions: ["REQUEST_INSTALL_PACKAGES"]`
en `app.json`, que `prebuild` aplica solo.

El permiso de Android 8+ "instalar apps desconocidas" no se consulta antes: no hay API de Expo
para `canRequestPackageInstalls()`. Lo pide el instalador del sistema, y si el intent falla el
modal ofrece un botón que abre esos ajustes.

## Fuera de alcance por ahora

Decisiones tomadas con el usuario; **no agregar sin pedirlo**:

- **Cola offline / sincronización diferida.** Hoy los censos se guardan localmente vía la capa `api`.
  Si se necesita, el cambio se contiene en `src/api/` (un `queue.ts` que envuelva a `http.ts`).
- **Autenticación con contraseña.** La ruta identifica al inspector, como en la demo.
- **Backend real.** Los endpoints de arriba son el contrato acordado, todavía no implementados.
