# 🚀 Guía del Nuevo Desarrollador

## Setup paso a paso

1. Clonar el repo.
2. `npm install` — respeta los `overrides`; no correr `npm update` sobre ellos
   (ver [06-DEPENDENCIAS.md](06-DEPENDENCIAS.md)).
3. `npm start` — abre el bundler de Expo (Metro). Escanea el QR con **Expo Go** en un Android, o
   presiona `a` con un emulador conectado.
4. No hace falta backend ni `.env`: arranca con `EXPO_PUBLIC_USE_MOCK=true` por default.
5. En el login, captura cualquier ruta (ej. `R-101`, sugerida como chip). No hay contraseña.
6. Recorre el flujo: tab **Censar** → "Simular escaneo" o toca un chip de serie → valida el
   resultado → completa el formulario (**la foto de la placa es obligatoria**) → guarda → revisa
   **Historial** y **Panel**.
7. `npm run check` para tener la línea base de reglas en verde.
8. Lee `CLAUDE.md` completo: es corto y concentra el vocabulario, las 7 reglas y los gotchas.

Series de prueba del mock: `IMB-100238`, `MTF-559012`, `OJE-778341`, `CRI-903115`, `IMB-100777`,
`MTF-441002`. Cualquier otra se registra como `NUEVO`.

## Cómo hacer los cambios más comunes

| Quiero… | Toco… |
|---|---|
| Cambiar una regla de negocio | `src/lib/rules.ts` + su assert en `src/lib/rules.check.ts`. **Nunca dentro de un `.tsx`** |
| Agregar un campo al registro | `src/api/types.ts` → el input en `app/censo/form.tsx` → la columna en `COLUMNAS_REPORTE` si va al reporte → el mapeo en `mapAlta()` de `http.ts` si viaja al backend |
| Agregar un dato del servidor | Método en `src/api/contract.ts` → implementarlo en `mock.ts` **y** `http.ts` (TS lo exige) → consumirlo en la pantalla |
| Agregar una pantalla | Un archivo en `app/`; expo-router la registra sola. Si lleva header, declararla en `app/_layout.tsx` |
| Cambiar colores o espaciado | `src/theme.ts`; los componentes de `src/ui/` los leen de ahí |
| Adaptar una respuesta del backend | Una función de mapeo **dentro de `src/api/http.ts`**, en el método que corresponda |
| Publicar una versión nueva del APK | `./scripts/release.sh patch "• changelog"` — ver [11-BUILD-Y-ACTUALIZACIONES.md](11-BUILD-Y-ACTUALIZACIONES.md) |

## Primeros tickets sugeridos

Áreas seguras, ordenadas por riesgo creciente:

- **Ajustar textos/copy** en cualquier pantalla de `app/` — sin lógica involucrada.
- **Agregar un caso a `src/lib/rules.check.ts`** para una regla existente — la forma más rápida de
  aprender `rules.ts` sin arriesgar UI.
- **Ajustar estilos** en `src/theme.ts` / `src/ui/index.tsx` — el sistema de diseño está
  centralizado y los cambios se propagan solos.
- **Limpieza real y acotada**: `npm uninstall expo-print` (dep declarada sin un solo import) —
  verificando antes que nada lo importe.
- **Exportar los mapeos de `src/api/http.ts` y cubrirlos con asserts** — el hueco de testing con
  más valor hoy (ver [08-TESTING.md](08-TESTING.md)).

Evitar como primer ticket: `src/api/index.ts` (el interruptor mock/http), `src/lib/rules.ts` sin
haber leído `CLAUDE.md`, y cualquier edición a mano dentro de `android/` (se regenera con
`prebuild`).

## Quién sabe qué

Proyecto de un solo desarrollador hasta ahora. Si el equipo crece, los dueños naturales por módulo:

- `src/lib/rules.ts` + `rules.check.ts` — quien mantenga el spec funcional
  (`SISTEMA DE CENSO DE ENFRIADORES.md`).
- `src/api/http.ts` + `client.ts` — quien integre y opere el backend.
- `scripts/release.sh` + `src/api/updates.ts` — quien publique los APK.

## Glosario del dominio

| Término | Significado |
|---|---|
| **Serie** (`numeroSerie`) | Llave única del enfriador. Todo gira alrededor de ella. |
| **FROG** | Base corporativa con los enfriadores ya asignados a clientes. Fuente de verdad externa que la app consulta, nunca modifica. |
| **CEDIS** / **UDN** | Centro de distribución al que pertenece el equipo. El backend lo llama `UDN`, el dominio `cedis`. |
| **Ruta** | Identifica al inspector. Hace las veces de login y acota casi toda consulta al backend. |
| **Status** / **tipoRegistro** | `CORRECTO` / `CORRECCIÓN` / `NUEVO`. Lo decide la existencia en FROG + la validación del usuario (§5). En el backend se llama `tipoRegistro` y va sin acento. |
| **Estado del enfriador** | Condición física: Usado Disponible, Descompuesto, Obsoleto, En Piso (§12.1). En el backend viaja en el campo `status` — no confundir con el de arriba. |
| **Censado** | `SI` / `NO`. Indicador principal de avance. |
| **En Piso** | El equipo está en el CEDIS, sin cliente asignado. Dispara la regla de `BODEGA`. |
| **BODEGA** | Cliente ficticio que se asigna automáticamente cuando el estado es "En Piso" (§12.2). |
| **Draft** | El censo en construcción, antes de guardarse. Vive solo en memoria. |
| **Upsert** | Guardar reemplaza el registro previo de la misma serie o lo agrega, nunca duplica (§8). Con backend real lo resuelve el servidor (409 si ya existe). |
| **Pendiente / Faltante** | Equipo que existe en FROG y todavía no tiene censo. Los `NUEVO` no cuentan como pendientes porque no estaban en FROG. |
| **Folio** | Consecutivo de la ronda de censo por ruta. Lo emite el backend; se muestra en Home y en el reporte. |
| **Evidencia** | Una foto subida y asociada a un cooler ya creado en el servidor. |
| **versionCode** | Entero de Android que la auto-actualización compara. No es el `versionName` ("1.0.3"). |

## Dónde profundizar

- Reglas de negocio exactas: `CLAUDE.md` y `src/lib/rules.ts`.
- Flujo completo de captura: [03-FLUJOS.md](03-FLUJOS.md).
- Endpoints y sus gotchas: [05-API.md](05-API.md).
- Conectar el backend: [07-CONFIGURACION.md](07-CONFIGURACION.md).
- Compilar y publicar: [11-BUILD-Y-ACTUALIZACIONES.md](11-BUILD-Y-ACTUALIZACIONES.md) y `COMPILAR.md`.
- El spec funcional original (fuente de verdad de las `§N`) vive en
  `../AppCensoEnfriadores_DEMO/SISTEMA DE CENSO DE ENFRIADORES.md`, fuera de este repo.
