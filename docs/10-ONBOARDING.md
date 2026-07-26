# 🚀 Guía del Nuevo Desarrollador

## Setup paso a paso

1. Clonar el repo.
2. `npm install`
3. `npm start` — abre el bundler de Expo (Metro). Escanea el QR con la app **Expo Go** en un
   teléfono Android, o presiona `a` con un emulador conectado (`npm run android` hace ambos pasos
   de una vez).
4. No hace falta backend ni `.env`: arranca con `EXPO_PUBLIC_USE_MOCK=true` por default, datos
   simulados en `src/api/mock.ts`.
5. En el login, captura cualquier ruta (ej. `R-101`, sugerida como chip). No hay contraseña.
6. Prueba el flujo completo: tab **Censar** → escanea/simula (`Simular escaneo` o toca un chip de
   serie de prueba) → valida el resultado → completa el formulario → guarda → revisa **Historial**
   y **Panel**.
7. Antes de tocar reglas de negocio, corre `npm run check` para tener la línea base en verde.
8. Lee `CLAUDE.md` completo — es corto y concentra el vocabulario del dominio y las 7 reglas.

## Primeros tickets sugeridos (áreas seguras para tocar sin romper nada)

- **Ajustar textos/copy** en cualquier pantalla de `app/` — bajo riesgo, sin lógica involucrada.
- **Agregar un campo visual de solo lectura** al reporte o al detalle de un registro (ver
  `CLAUDE.md` § *Agregar un campo al registro*) — toca `types.ts`, `form.tsx` y
  `COLUMNAS_REPORTE`, buen ejercicio para entender el flujo completo de un dato.
- **Agregar un caso a `src/lib/rules.check.ts`** para una regla existente que no esté cubierta —
  forma rápida de aprender `rules.ts` sin arriesgar romper UI.
- **Ajustar estilos** en `src/theme.ts` / `src/ui/index.tsx` — el sistema de diseño está
  centralizado, cambios ahí se propagan solos a toda la app.
- **Agregar un catálogo nuevo** (ej. más marcas o CEDIS) en `CATALOGOS` de `src/api/mock.ts`.

Evitar como primer ticket: tocar `src/api/index.ts` (el interruptor mock/http) o
`src/lib/rules.ts` sin antes leer `CLAUDE.md` y entender las 7 reglas — son el corazón del
proyecto y cualquier cambio ahí afecta 3+ pantallas a la vez.

## Quién sabe qué

No hay áreas de expertise documentadas por persona en este repo (proyecto de un solo desarrollador
hasta ahora). Si el equipo crece, el punto natural de "dueño" por módulo sería:

- `src/lib/rules.ts` + `rules.check.ts` — quien mantenga el spec funcional
  (`SISTEMA DE CENSO DE ENFRIADORES.md`) debería revisar cualquier cambio aquí.
- `src/api/http.ts` + `client.ts` — quien integre el backend real cuando exista.

## Glosario del dominio

| Término | Significado |
|---|---|
| **Serie** (`numeroSerie`) | Llave única del enfriador. Todo gira alrededor de ella. |
| **FROG** | Base corporativa con los enfriadores ya asignados a clientes. Fuente de verdad externa que la app consulta, nunca modifica directamente. |
| **CEDIS** | Centro de distribución al que pertenece el equipo. |
| **Ruta** | Identifica al inspector. Hace las veces de login (sin contraseña). |
| **Status** | `CORRECTO` / `CORRECCIÓN` / `NUEVO`. Lo decide el sistema (existencia en FROG) + la validación del usuario. |
| **Estado del enfriador** | Condición física reportada en campo: Usado Disponible, Descompuesto, Obsoleto, En Piso. No confundir con `Status`. |
| **Censado** | `SI` / `NO`. Indicador principal de avance del proyecto — `SI` una vez guardado, `NO` en filas de reporte de equipos pendientes de FROG. |
| **En Piso** | El equipo está en el CEDIS, sin cliente asignado. Dispara la regla de asignación automática a `BODEGA`. |
| **BODEGA** | Cliente ficticio que se asigna automáticamente cuando el estado es "En Piso". |
| **Draft** | El censo en construcción, antes de guardarse. Vive solo en memoria durante el flujo de captura. |
| **Upsert** | Guardar reemplaza el registro previo de la misma serie o lo agrega — nunca duplica. |
| **Pendiente** | Equipo que existe en FROG pero todavía no tiene censo asociado. Los equipos `NUEVO` (no estaban en FROG) no cuentan como pendientes. |

## Dónde profundizar

- Reglas de negocio exactas: `CLAUDE.md` y `src/lib/rules.ts`.
- Flujo completo de captura: [03-FLUJOS.md](03-FLUJOS.md).
- Cómo conectar el backend real cuando exista: [07-CONFIGURACION.md](07-CONFIGURACION.md).
- El spec funcional original (fuente de verdad de las reglas, con numeración `§N`) vive en
  `../AppCensoEnfriadores_DEMO/SISTEMA DE CENSO DE ENFRIADORES.md`, fuera de este repo.
