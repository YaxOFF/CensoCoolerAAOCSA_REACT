# ✅ Cómo se Valida

## Estrategia de testing

**Solo unitario, y solo sobre código puro.** No hay tests de integración, e2e ni de componentes.
Es deliberado: `src/lib/rules.ts` (reglas de negocio) y `src/lib/version.ts` (parseo del
`version.json` remoto) concentran la lógica que puede romperse en silencio, precisamente para que
sea verificable sin React Native, sin Expo y sin simulador. Las pantallas son cableado y se validan
a mano en Expo Go / dispositivo.

No hay cobertura objetivo formal (no hay Jest, no hay `--coverage`). La cobertura real es "las 7
reglas del spec, cada una con su caso feliz y sus edge cases conocidos, más el parser de versión".

## Cómo correr

```bash
npm run check
```

Equivale a `node --experimental-strip-types --no-warnings src/lib/rules.check.ts`. Sin watch mode ni
filtros: es un script secuencial que aborta en el primer assert fallido con
`✗ <descripción> esperado/recibido`. Éxito imprime dos líneas:

```
✓ reglas del censo OK
✓ version.json OK
```

`scripts/release.sh` corre `npm run check` y `npm run typecheck` **antes** de compilar el APK, así
que una regla rota corta el release.

## Estructura

Un único archivo: `src/lib/rules.check.ts`. Sin framework (`describe`/`it`): imports + fixtures +
`assert.equal`/`assert.deepEqual` planos, agrupados por comentario según la regla del spec
(`/* Regla 1 (§5) — … */`).

- `assert` — implementación mínima propia (`equal`, `deepEqual`) porque `node:assert` no resuelve
  bajo la configuración de módulos de Expo.
- `CATALOGOS`, `frog(serie, cedis?)`, `censo(serie, overrides?)` — fixtures locales, no los del
  mock.
- No hay mocking de red ni de AsyncStorage porque el código bajo prueba no los usa.

**Por qué no Jest**: cero dependencias de testing y feedback en milisegundos ejecutando TypeScript
directo, sin paso de compilación.

## Qué cubre exactamente

| Cobertura | Qué protege |
|---|---|
| `resolverStatus()` (§5) | Serie inexistente ⇒ `NUEVO`; sin validación explícita el status queda `null` |
| `camposEditables()` (§6) | Que solo `CORRECTO` bloquee campos |
| `aplicarEnPiso()` (§12.2) | El caso más sutil: entrar **dos veces** a "En Piso" no debe pisar el respaldo del cliente con `BODEGA` |
| `validarDraft()` (§7, §12.1) | Sin serie, sin status, sin estado **y sin foto de Placa** (incluye el caso de una `Placa` con `uri` vacía, y que una foto Frontal no alcanza) |
| `upsertRegistro()` (§8) | Reemplaza por serie, nunca duplica, y no muta el arreglo original |
| `construirResumen()` (§9) | El avance: `censados` cuenta todos los levantamientos, pero el porcentaje se calcula solo contra el universo de FROG — los `NUEVO` no descuentan pendientes. La distribución muestra el catálogo completo aunque esté en cero |
| `construirReporte()` (§10) | Censados + pendientes, y que los pendientes salgan con `status: ''` |
| `construirCsv()` | BOM presente (acentos en Excel) y escape correcto de comillas dobles |
| `normalizarVersion()` | JSON no-objeto, `versionCode` faltante o no entero, `apkUrl` faltante ⇒ `null`; relativa cuelga del servidor sin doble diagonal; absoluta se respeta; `forceUpdate` solo con booleano `true` (la cadena `"true"` no cuenta) |

## Qué NO está cubierto

- **Pantallas** (`app/**/*.tsx`) — sin tests; se validan manualmente.
- **`src/api/http.ts`** — ni un assert, y es donde vive todo el conocimiento del backend: los
  mapeos de enums (`CORRECCIÓN`→`CORRECCION`, `En Piso`→`EN PISO`), `normalizaTipo()`,
  `mapResumen()`, la paginación de `getReporte()`. Son funciones puras y **serían trivialmente
  testeables** si se exportaran. `[TODO: hoy son privadas del módulo; exportarlas y cubrirlas es el
  siguiente paso obvio de testing.]`
- **`src/api/client.ts`** — el cálculo del estado de red y `mensajeDeError()` (RFC 7807).
- **`src/lib/device.ts`** — depende de APIs nativas; su contrato de resiliencia (nunca lanza) es la
  garantía en su lugar.
- **`src/store/*`** — transiciones del draft, guard de sesión.
- **Componentes de `src/ui/`** — sin snapshot ni render tests.

Si algún día se agrega Jest/RNTL, los candidatos por valor son: los mapeos de `http.ts` (primero),
`app/censo/form.tsx` y `src/store/draft.tsx`.

## Checklist manual antes de publicar una versión

No está automatizado; es lo que conviene recorrer en dispositivo con `USE_MOCK=false`:

1. Login con una ruta real → los KPIs de Home traen números.
2. Censar una serie que **sí** está en FROG → validar "correcta" → campos bloqueados → guardar con
   foto de placa → aparece en Historial ▸ Censados con sus evidencias visibles.
3. Censar una serie inventada → status `NUEVO` → campos abiertos → guardar.
4. Elegir "En Piso" → el cliente pasa a `BODEGA` y se bloquea; cambiar de estado lo restaura.
5. Historial ▸ En FROG y ▸ Faltantes traen filas para la ruta.
6. Reporte: generar Excel y PDF, abrir y descargar.
7. Apagar el backend → el banner rojo aparece; encenderlo → desaparece.
