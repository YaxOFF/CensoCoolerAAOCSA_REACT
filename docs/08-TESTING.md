# ✅ Cómo se Valida

## Estrategia de testing

**Solo unitario, y solo sobre reglas de negocio puras.** No hay tests de integración, e2e, ni de
componentes React. Esto es una decisión deliberada, no un vacío: `src/lib/rules.ts` concentra toda
la lógica de negocio no trivial precisamente para que sea testeable sin React Native, sin Expo y sin
un simulador — las pantallas son "solo cableado" y se validan manualmente en el dispositivo/Expo Go.

No hay cobertura objetivo formal (no hay Jest, no hay `--coverage`). La cobertura real es "las 7
reglas de negocio del spec, cada una con al menos un caso feliz y sus edge cases conocidos".

## Cómo correr los tests

```bash
npm run check
```

Equivale a `node --experimental-strip-types --no-warnings src/lib/rules.check.ts`. No hay watch
mode ni filtros por nombre de test — es un script secuencial que corre de arriba a abajo y aborta
en el primer `assert` fallido con un mensaje `✗ <descripción> esperado/recibido`. Éxito imprime
`✓ reglas del censo OK`.

## Estructura de tests

Un único archivo: `src/lib/rules.check.ts`. No sigue ningún framework (`describe`/`it`); es una
secuencia de imports + fixtures + `assert.equal`/`assert.deepEqual` planos, agrupados por comentario
según la regla del spec que cubren (`/* Regla 1 (§5) — … */`).

**Por qué no Jest**: `package.json` no declara ningún test runner. El proyecto usa
`node --experimental-strip-types` para ejecutar TypeScript directo sin paso de compilación —
mantiene el ciclo de feedback en milisegundos y cero dependencias de testing.

## Mocks y fixtures

Todo vive dentro de `rules.check.ts`, no hay carpeta `__mocks__` ni `fixtures/`:

- `assert` — implementación mínima propia (`equal`, `deepEqual`) porque `node:assert` no resuelve
  bajo la configuración de módulos de Expo.
- `CATALOGOS` — catálogo reducido de prueba (no el de `mock.ts`).
- `frog(numeroSerie, cedis?)` — factory de un `Enfriador` de prueba.
- `censo(numeroSerie, overrides?)` — factory de un `RegistroCenso` de prueba con valores por
  defecto razonables, sobreescribibles.

No hay mocking de red ni de AsyncStorage porque `rules.ts` no los usa — es intencional (ver
`02-ARQUITECTURA.md`).

## Tests más críticos ("guardianes" del proyecto)

| Cobertura | Qué protege |
|---|---|
| `resolverStatus()` (§5) | Que serie inexistente en FROG siempre resuelva `NUEVO`, y que sin validación explícita el status quede `null` (no se guarda prematuramente) |
| `camposEditables()` (§6) | Que solo `CORRECTO` bloquee campos — un cambio accidental aquí desbloquearía o bloquearía mal todo el formulario |
| `aplicarEnPiso()` (§12.2) | El caso más sutil del proyecto: que el cliente original se respalde una sola vez y no se sobrescriba con `'BODEGA'` si el usuario entra dos veces seguidas a "En Piso" — cubierto explícitamente como caso propio |
| `validarDraft()` (§12.1) | Que no se pueda guardar sin serie, sin status o sin estado del enfriador |
| `upsertRegistro()` (§8) | Que guardar la misma serie **reemplace**, nunca duplique, y que no mute el arreglo original (inmutabilidad) |
| `construirResumen()` / `construirReporte()` (§9, §10) | El cálculo de avance y el universo del reporte — incluye el caso donde los equipos `NUEVO` no descuentan pendientes porque no estaban en FROG (la demo HTML original tenía este cálculo duplicado e inconsistente entre pantallas; aquí se unificó) |
| `construirCsv()` | BOM presente (acentos en Excel) y escape correcto de comillas dobles en observaciones |

## Qué NO está cubierto

- Pantallas (`app/**/*.tsx`) — sin tests, se validan manualmente en Expo Go/dispositivo.
- `src/lib/device.ts` (GPS/cámara) — depende de APIs nativas, no es practicable con
  `node --experimental-strip-types`; su contrato de resiliencia (nunca lanza) es la garantía en su
  lugar.
- `src/api/http.ts` — sin backend real desplegado, no hay contra qué probarlo end-to-end.
- Componentes de `src/ui/index.tsx` — sin snapshot tests ni render tests.

Si se agrega Jest/RNTL en el futuro, el candidato natural es cubrir primero `app/censo/form.tsx`
(la pantalla con más lógica cableada) y `src/store/draft.tsx` (transiciones de estado del draft).
