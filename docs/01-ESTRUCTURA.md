# 🗺️ Mapa del Territorio

## Árbol de directorios

```
app/                      Rutas (expo-router, file-based routing). Solo UI y cableado a `api`/store.
  _layout.tsx              Providers globales + Stack de navegación + guard de sesión.
  login.tsx                 Captura de ruta (= login sin contraseña).
  (tabs)/                   Grupo de rutas con tab bar.
    _layout.tsx              Define las 4 tabs: Inicio · Censar · Historial · Panel.
    index.tsx                 Home: KPIs + accesos rápidos.
    search.tsx                 Escaneo/captura de serie → dispara lookupEnfriador.
    history.tsx                 Lista de censos guardados.
    dashboard.tsx                Indicadores de avance (§9).
  censo/                    El flujo de captura (fuera de las tabs, apila sobre el Stack).
    result.tsx                Resultado de FROG + validación (§5, §6).
    form.tsx                    El formulario del censo (el archivo más grande de la app).
    done.tsx                     Confirmación de guardado (§8).
  report.tsx                Reporte corporativo + exportación (§10).

src/
  api/                      ÚNICA capa que sabe de dónde vienen los datos. Ver 05-API.md.
    types.ts                  Modelo de dominio (interfaces TS).
    contract.ts                interface CensoApi: los 8 métodos que la app necesita.
    mock.ts                     Implementación simulada: FROG en memoria + AsyncStorage.
    http.ts                      Implementación real: fetch contra un backend.
    client.ts                     Wrapper de fetch (URL base, headers, timeout, ApiError).
    index.ts                       Punto único de cambio: exporta `api` = mock o http.
  store/                    Context providers (estado global de React).
    session.tsx                Ruta del inspector (login).
    records.tsx                 Registros censados (fuente de verdad de Historial/Dashboard).
    draft.tsx                    Censo en construcción durante search → result → form → done.
    catalogos.ts                  Hook que trae tipos/estados/CEDIS/rutas de `api`.
    resumen.ts                     Hook que trae los indicadores de `api`, recarga con el foco.
  lib/                      Lógica de negocio y utilidades, sin React.
    rules.ts                   Las 7 reglas de negocio, funciones puras. EL archivo más importante.
    rules.check.ts               Self-check ejecutable de rules.ts (`npm run check`).
    device.ts                   GPS y cámara: nunca falla, cae a datos simulados.
    export.ts                    Exportar el reporte a CSV/PDF y compartirlo.
    format.ts                    Formato de fecha/coordenadas/porcentaje para mostrar en UI.
  ui/index.tsx               Componentes base (Card, Field, Select, Badge, StatRow, DistBars…).
  theme.ts                   Colores, radios, sombra, helpers de color por status y por estado.

app.json                  Config de Expo: nombre, ícono, permisos de cámara/GPS, plugins.
.env.example               Plantilla de variables de entorno (copiar a .env).
tsconfig.json               Alias @/* → src/*, strict mode.
CLAUDE.md                   Documento maestro para agentes/desarrolladores: reglas, convenciones.
SISTEMA DE CENSO DE ENFRIADORES.md (en la demo hermana)  Fuente de verdad de las reglas de negocio.
```

## Archivos clave

| # | Archivo | Por qué importa |
|---|---|---|
| 1 | `src/lib/rules.ts` | Las 7 reglas de negocio del censo, en un solo lugar, como funciones puras. Cualquier cambio de negocio empieza y termina aquí. |
| 2 | `src/api/contract.ts` | El contrato entre pantallas y datos. Agregar un método aquí obliga (por TS) a implementarlo en mock y http. |
| 3 | `src/api/index.ts` | El interruptor mock↔backend real. Un archivo de 24 líneas que decide toda la app. |
| 4 | `src/api/mock.ts` | La base FROG simulada (`FROG`), el seed de registros (`SEED`) y la persistencia en AsyncStorage. |
| 5 | `src/api/http.ts` | Implementación real ya escrita contra el contrato acordado; el lugar para mapear la forma real del backend cuando exista. |
| 6 | `src/api/types.ts` | El modelo de dominio: `Enfriador`, `RegistroCenso`, `Draft`, `Resumen`, `Reporte`. Todo en español porque viaja tal cual al backend. |
| 7 | `app/censo/form.tsx` | La pantalla más grande: cablea 4 de las 7 reglas de negocio (bloqueo de campos, En Piso, estado obligatorio, sello del levantamiento). |
| 8 | `src/store/draft.tsx` | El censo en construcción; equivalente a `sessionStorage` de la demo — vive solo en memoria. |
| 9 | `src/store/records.tsx` | Única fuente de verdad de los registros ya guardados; Historial y Dashboard dependen de ella indirectamente (vía `api`). |
| 10 | `app/_layout.tsx` | Providers globales + guard de sesión: sin ruta capturada, cualquier pantalla redirige a `/login`. |
| 11 | `src/lib/rules.check.ts` | Todo el "test suite" del proyecto: 20+ asserts sobre `rules.ts`, sin framework. |
| 12 | `src/lib/device.ts` | Contrato de resiliencia de hardware: nunca lanza, siempre devuelve algo usable (`mock: true` si simulado). |
| 13 | `src/ui/index.tsx` | Todo el sistema de diseño en un archivo: Card, Field, Select, Segmented, Badge, StatRow, DistBars, etc. |
| 14 | `src/theme.ts` | Paleta de colores y helpers (`statusColor`, `estadoColor`, `estadoLabel`, `tint`) — la app está fija en modo claro. Las dos nomenclaturas de color están documentadas en `04-DATOS.md`. |
| 15 | `CLAUDE.md` | Vocabulario del dominio, las 7 reglas explicadas, cómo hacer cambios comunes. Léelo antes de tocar código de negocio. |

## Convenciones del proyecto

- **Nombres de campo en español** (`numeroSerie`, `estadoEnfriador`, `nombreCliente`): son los que
  viajarán al backend real. No se traducen a inglés en ningún nivel (tipos, mock, UI).
- **Comentarios en español**, explicando el *porqué* y citando la sección del spec funcional
  (`§4`, `§6`, `§12.2`…) cuando aplica una regla de negocio. No se repite lo que el código ya dice.
- **Sin librerías de UI ni de estado.** Context API + `StyleSheet` únicamente.
- **Los estados de carga/error se muestran**, nunca se tragan silenciosamente: `Loading`, `Empty`,
  `Alert.alert`.
- **Alias de import** `@/*` apunta a `src/*` (configurado en `tsconfig.json`).
- **Regla dura de arquitectura**: las pantallas (`app/**/*.tsx`) solo llaman a `api.*`. Ningún
  `fetch` ni dato simulado fuera de `src/api/`.
- **Un archivo por tipo de componente reutilizable** (`src/ui/index.tsx`) en vez de un archivo por
  componente: son piezas chicas que siempre se usan juntas.

## Puntos de entrada

- **Arranque de la app**: `expo-router/entry` (declarado en `package.json` como `"main"`) monta
  `app/_layout.tsx`, que envuelve todo en `SessionProvider` → `RecordsProvider` → `DraftProvider` y
  luego renderiza el `Stack` de navegación.
- **Guard de sesión**: dentro de `app/_layout.tsx`, el componente `Navegacion()` redirige a
  `/login` si no hay `ruta` capturada, y de `/login` hacia `/` si ya la hay.
- **Primera pantalla real tras login**: `app/(tabs)/index.tsx` (Home).
- **Comandos CLI**: no hay CLI propia; se usa la de Expo (`npm start`, `npm run android`) y dos
  scripts de proyecto: `npm run check` (reglas de negocio) y `npm run typecheck` (`tsc --noEmit`).
- **Flujo de captura**: entra por `app/(tabs)/search.tsx`, atraviesa `app/censo/result.tsx` →
  `app/censo/form.tsx` → `app/censo/done.tsx`.
