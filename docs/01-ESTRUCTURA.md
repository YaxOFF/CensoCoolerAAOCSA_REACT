# 🗺️ Mapa del Territorio

## Árbol de directorios

```
app/                      Rutas (expo-router, file-based routing). Solo UI y cableado a `api`/store.
  _layout.tsx              Providers globales + Stack + guard de sesión + <BannerRed> + <ModalActualizacion>.
  login.tsx                 Captura de ruta (= login sin contraseña).
  (tabs)/                   Grupo de rutas con tab bar.
    _layout.tsx              Define las 4 tabs: Inicio · Censar · Historial · Panel.
    index.tsx                 Home: KPIs (tocables) + accesos rápidos.
    search.tsx                 Escaneo/captura de serie → dispara lookupEnfriador.
    history.tsx                 Listado en 3 modos: Censados / En FROG / Faltantes (419 líneas).
    dashboard.tsx                Indicadores de avance (§9).
  censo/                    El flujo de captura (fuera de las tabs, apila sobre el Stack).
    result.tsx                Resultado de FROG + validación (§5, §6).
    form.tsx                    El formulario del censo (315 líneas).
    done.tsx                     Confirmación de guardado (§8).
  report.tsx                Genera el reporte EN EL SERVIDOR y ofrece abrir/descargar/compartir/QR.

src/
  api/                      ÚNICA capa que sabe de dónde vienen los datos. Ver 05-API.md.
    types.ts                  Modelo de dominio + tipos crudos del backend (FrogRow, Cooler).
    contract.ts                interface CensoApi: los 10 métodos que la app necesita.
    mock.ts                     Implementación simulada: FROG en memoria + AsyncStorage.
    http.ts                      Implementación real: fetch + mapeos backend↔dominio (403 líneas).
    client.ts                     Wrapper de fetch (URL base, token, timeout, ApiError) + estado de red.
    updates.ts                     Auto-actualización del APK (version.json → descarga → instalador).
    index.ts                        Punto único de cambio: exporta `api` = mock o http.
  store/                    Estado compartido (Context providers y hooks).
    session.tsx                Ruta del inspector (login) + `usuario` derivado.
    records.tsx                 Provider de registros vía api.listRegistros(). Ver nota abajo.
    draft.tsx                    Censo en construcción durante search → result → form → done.
    catalogos.ts                  Hook que trae tipos/estados/CEDIS/rutas de `api`.
    resumen.ts                     Hook de indicadores, recarga con useFocusEffect.
  lib/                      Lógica de negocio y utilidades, sin React.
    rules.ts                   Las 7 reglas de negocio, funciones puras. EL archivo más importante.
    rules.check.ts               Self-check ejecutable de rules.ts y version.ts (`npm run check`).
    device.ts                   GPS y cámara: nunca falla, cae a datos simulados.
    version.ts                   Parseo/validación del version.json remoto (borde de confianza).
    format.ts                    Formato de fecha/coordenadas/porcentaje para mostrar en UI.
  ui/
    index.tsx                  Sistema de diseño completo: 28 componentes (639 líneas).
    BannerRed.tsx               Aviso "sin conexión / red inestable".
    ModalActualizacion.tsx      Aviso de nueva versión del APK, con progreso y reintento.
  theme.ts                   Colores, radios, sombra, helpers de color por status y por estado.

scripts/release.sh        Sube versión (app.json + version.json) y compila el APK. Ver 11-BUILD.
app.json                  Config de Expo: nombre, ícono, versionCode, permisos, plugins.
version.json              Lo que se publica en el servidor de updates junto al APK.
.env.example               Plantilla documentada de las 5 variables de entorno.
tsconfig.json               Alias @/* → src/*, strict mode.
CLAUDE.md                   Documento maestro: vocabulario, reglas, convenciones, gotchas.
COMPILAR.md                 Procedimiento completo del APK (fuente de verdad del build).
```

> ⚠️ **`src/store/records.tsx` casi no se usa ya.** Su `registros` solo lo consume
> `app/censo/form.tsx` — y únicamente como semilla para el GPS simulado
> (`obtenerGps(registros.length)`). Historial y Dashboard migraron a `api.listCoolers()` /
> `api.getResumen()`. Aun así el provider llama a `api.listRegistros()` (`GET /censos`) al montar
> la app: si ese endpoint no existe en el backend, se traga el error en su propio estado
> (`error`, que nadie lee) pero la llamada se hace igual en cada arranque.

## Archivos clave

| # | Archivo | Por qué importa |
|---|---|---|
| 1 | `src/lib/rules.ts` | Las 7 reglas de negocio del censo, en un solo lugar, como funciones puras. Cualquier cambio de negocio empieza y termina aquí. |
| 2 | `src/api/contract.ts` | El contrato entre pantallas y datos. Agregar un método aquí obliga (por TS) a implementarlo en mock y http. |
| 3 | `src/api/index.ts` | El interruptor mock↔backend real. 24 líneas que deciden toda la app. |
| 4 | `src/api/http.ts` | El archivo con más "conocimiento del backend": todos los mapeos de nombres, enums y formas viven ahí. |
| 5 | `src/api/client.ts` | El único `fetch()` de la app (salvo `updates.ts`), más el cálculo del estado de red que alimenta `<BannerRed>`. |
| 6 | `src/api/types.ts` | El modelo de dominio **y** los tipos crudos del backend. Todo en español porque viaja tal cual. |
| 7 | `app/censo/form.tsx` | Cablea 4 de las 7 reglas (bloqueo de campos, En Piso, validación, sello del levantamiento). |
| 8 | `app/(tabs)/history.tsx` | La pantalla más grande: 3 modos de listado, paginación, modal de detalle con evidencias. |
| 9 | `src/store/draft.tsx` | El censo en construcción; vive solo en memoria (equivalente al `sessionStorage` de la demo). |
| 10 | `app/_layout.tsx` | Providers + guard de sesión + los dos overlays globales (`BannerRed`, `ModalActualizacion`). |
| 11 | `src/lib/rules.check.ts` | Todo el "test suite" del proyecto: asserts sobre `rules.ts` y `version.ts`, sin framework. |
| 12 | `src/lib/device.ts` | Contrato de resiliencia de hardware: nunca lanza, siempre devuelve algo usable (`mock: true` si simulado). |
| 13 | `src/ui/index.tsx` | Todo el sistema de diseño en un archivo: Card, Field, Select, Segmented, Badge, StatRow, DistBars, etc. |
| 14 | `src/theme.ts` | Paleta y helpers (`statusColor`, `estadoColor`, `estadoLabel`, `tint`) — app fija en modo claro. Las dos nomenclaturas de color están en [04-DATOS.md](04-DATOS.md). |
| 15 | `src/api/updates.ts` | Auto-actualización del APK: la app se reparte fuera de Play Store. Ver [11-BUILD-Y-ACTUALIZACIONES.md](11-BUILD-Y-ACTUALIZACIONES.md). |
| 16 | `CLAUDE.md` | Vocabulario del dominio, las 7 reglas, gotchas (overrides de npm, JDK 17, `.env` embebido). |

## Componentes de `src/ui/index.tsx`

Un solo archivo, 28 exports. Nada de esto vive en una librería externa.

| Grupo | Componentes |
|---|---|
| Tipografía | `H1`, `H2`, `Section`, `Muted`, `Hint`, `Hero`, `ViewHead` |
| Contenedores | `Card`, `Screen` (scroll + safe area + pull-to-refresh), `Note` |
| Botones | `PrimaryButton`, `SecondaryButton`, `GhostButton`, `MiniButton`, `Chip` |
| Formulario | `Field`, `Input`, `Select`, `Segmented` |
| Datos | `Badge`, `Tag`, `StatRow`, `KeyValues`, `DistBars`, `ProgressBar` |
| Estados | `Empty`, `Loading` |
| Tipos | `IconName` (nombres válidos de Ionicons) |

## Convenciones del proyecto

- **Nombres de campo en español** (`numeroSerie`, `estadoEnfriador`, `nombreCliente`): son los que
  viajan al backend real. No se traducen a inglés en ningún nivel (tipos, mock, UI).
- **Comentarios en español**, explicando el *porqué* y citando la sección del spec funcional
  (`§4`, `§6`, `§12.2`…). No se repite lo que el código ya dice.
- **Marcador `ponytail:`** en comentarios = simplificación deliberada, con su techo y su camino de
  upgrade escritos al lado (ej. el reintento de evidencias en `http.ts:saveRegistro`).
- **Sin librerías de UI ni de estado.** Context API + `StyleSheet` únicamente.
- **Los estados de carga/error se muestran**, nunca se tragan: `Loading`, `Empty`, `Alert.alert`.
- **Alias de import** `@/*` apunta a `src/*` (configurado en `tsconfig.json`). Dentro de `src/` se
  usan tanto rutas relativas (`../lib/rules`) como el alias; ambas conviven.
- **Regla dura de arquitectura**: las pantallas (`app/**/*.tsx`) solo llaman a `api.*`. Ningún
  `fetch` ni dato simulado fuera de `src/api/`.

## Puntos de entrada

- **Arranque de la app**: `expo-router/entry` (declarado en `package.json` como `"main"`) monta
  `app/_layout.tsx`, que envuelve todo en `SessionProvider` → `RecordsProvider` → `DraftProvider`,
  renderiza el `Stack` y encima `<BannerRed>` y `<ModalActualizacion>`.
- **Guard de sesión**: `Navegacion()` dentro de `app/_layout.tsx` redirige a `/login` si no hay
  `ruta` capturada, y de `/login` hacia `/` si ya la hay.
- **Primera pantalla real tras login**: `app/(tabs)/index.tsx` (Home).
- **Flujo de captura**: entra por `app/(tabs)/search.tsx` → `app/censo/result.tsx` →
  `app/censo/form.tsx` → `app/censo/done.tsx`.
- **Deep link con parámetro**: las tarjetas de Home navegan a `/history?modo=frog|censados|faltantes`;
  `history.tsx` lee el query con `useLocalSearchParams`.
- **Comandos**: los de Expo (`npm start`, `npm run android`) más `npm run check` (reglas) y
  `npm run typecheck`. El build del APK no está en `package.json`: es `scripts/release.sh`.
