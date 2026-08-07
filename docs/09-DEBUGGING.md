# 🐛 Cuando algo Falla

## Logs

No hay logging estructurado ni servicio externo (Sentry, etc.). Los canales disponibles:

- **Consola de Metro** (`npm start`): `console.*` y errores no capturados de JS/React. El único
  `console.warn` propio del proyecto es el de la evidencia que no se pudo subir
  (`src/api/http.ts:saveRegistro`).
- **Errores de red**: todos pasan por `ApiError` (`src/api/client.ts`), con `message`, `status` y
  `body`. El `body` casi siempre trae más contexto que el `message`.
- **Errores de actualización**: `UpdateError` con `causa: 'red' | 'json' | 'descarga' | 'instalacion'`.
- **Errores de usuario**: se muestran con `Alert.alert`, no solo se loguean.
- **Logcat de Android** (`adb logcat`) para lo que pasa por debajo de JS: permisos, cámara, crashes
  nativos, el instalador del APK.

## Errores comunes y soluciones

| Síntoma | Causa probable | Solución |
|---|---|---|
| **La app se cierra sola al abrir, sin error en Metro** | Versión de `react-native-worklets`/`reanimated` distinta a la que Expo Go trae compilada → `SIGSEGV` en `libworklets.so` | Restaurar los `overrides` de `package.json` y `npm install`. Diagnóstico en [06-DEPENDENCIAS.md](06-DEPENDENCIAS.md) |
| Cambié `.env` y no pasó nada | Metro cachea las `EXPO_PUBLIC_*` | `npx expo start -c` |
| `EXPO_PUBLIC_API_URL no está configurada` | `USE_MOCK=false` sin `API_URL`, o no existe `.env` | Copiar `.env.example` y reiniciar con `-c` |
| **Banner rojo permanente aunque el backend responde** | El `reachabilityUrl` es `{API_URL}/health`: si a `API_URL` le falta el `/api`, o `/health` no existe, NetInfo lo lee como caída | Probar `curl {API_URL}/health` → debe dar 200. Ver [07-CONFIGURACION.md](07-CONFIGURACION.md) |
| Banner ámbar "red inestable" | Alguna respuesta tardó ≥ 5 s | Es informativo; se limpia con la siguiente respuesta rápida |
| Timeout en Android físico | `API_URL=http://localhost:…` — el teléfono no ve el localhost de la PC | `adb reverse tcp:PUERTO tcp:PUERTO`, o usar la IP LAN |
| **400 al guardar un censo** | Enum mal serializado (`CORRECCIÓN` con acento, `EN_PISO` con guion bajo) o campo requerido vacío | El mensaje del 400 trae el detalle campo por campo (`client.ts` concatena `errors`). Los mapeos correctos están en `http.ts` |
| **409 al guardar** | Esa serie ya se censó en la ronda vigente | Es el upsert del §8 resuelto del lado del servidor; no reintentar a ciegas. En la cola offline el 409 **saca** el censo de la cola: ya está en el servidor |
| **El modal "Sin Internet" no aparece al caerse la red** | El modo ya está activo, se descartó con "Ahora no" en esta misma caída, o `USE_MOCK=true` (el mock no pasa por `client.ts`) | El descarte se resetea cuando la red vuelve a `ok`. Ver [12-MODO-OFFLINE.md](12-MODO-OFFLINE.md) |
| **El modal dice "no hay datos descargados"** | Nunca se abrió Inicio con red: la precarga solo corre ahí (decisión de producto) | Conectarse y abrir la pestaña Inicio; la línea de estado confirma cuántos equipos quedaron |
| **El modo Sin Internet no se apaga al volver la red** | El sondeo a `/health` todavía no confirma (`redConfirmada()` sigue en `false`) | Esperar el sondeo (≤5 s sin red) o forzar tráfico. El `'ok'` del arranque es optimista y a propósito no cuenta |
| **Censos en rojo que no se van** | El envío falló y el censo sigue encolado a propósito: nada sale de la cola sin 2xx o 409 | Abrir el detalle: trae el motivo exacto en "Sin enviar al servidor". Reintentar con *Enviar pendientes* |
| Un pendiente perdió sus fotos | `copyAsync` a `documentDirectory` falló y la caché se vació antes del envío | El censo se manda igual sin esa evidencia; es el mal menor elegido. Ver [12-MODO-OFFLINE.md § 6](12-MODO-OFFLINE.md) |
| El avance del Dashboard no cuadra sin red | `getResumen` offline **estima**: suma la cola al último resumen cacheado | Esperado. Se corrige al sincronizar y volver a Inicio |
| El censo se guardó pero le faltan fotos | Una evidencia falló al subir; el censo NO se tumba a propósito | Buscar el `console.warn('No se pudo subir la evidencia …')` en Metro |
| Las fotos del Historial salen rotas | El backend emite las URLs con un host que el teléfono no alcanza | Setear `EXPO_PUBLIC_IMG_URL` con el host alcanzable, o usar `adb reverse` |
| Formulario no deja editar campos de cliente/equipo | Esperado si `status === 'CORRECTO'` (§6) | Solo `CORRECCIÓN`/`NUEVO` habilitan edición |
| Cliente forzado a "BODEGA" e intocable | Estado = "En Piso" (§12.2), intencional | Cambiar el estado para restaurar el cliente previo |
| **"Guardar censo" no hace nada visible** | `validarDraft()` cortó — lo más frecuente hoy es que **falte la foto de la placa** | Leer el `Alert.alert`; la placa es obligatoria desde la versión con foto obligatoria |
| El `Select` de tipo de enfriador sale vacío | `TIPOENFRI` de FROG llegó con espacios/acentos raros y no empató | `normalizaTipo()` ya cubre lo conocido; si aparece una clave nueva, agregarla a `TIPOS_ENFRIADOR` (`src/api/types.ts`) |
| Dashboard sin "Avance por CEDIS" | El backend no agrupa por CEDIS/tipo/marca; `mapResumen()` los deja vacíos y el bloque está comentado | Esperado. Ver [04-DATOS.md](04-DATOS.md) |
| Historial ▸ En FROG / Faltantes salen vacíos | Sin `ruta` en sesión esos modos ni siquiera llaman al backend (`ruta ? … : []`) | Verificar la ruta capturada en el login |
| Escáner no abre / cámara negra | Permiso de cámara denegado | `search.tsx` cae a captura manual; revisar permisos del SO |
| Foto como cuadro de color | Es una foto simulada (`mock://…`) por falta de permiso de cámara | Esperado en emulador; esas fotos no se suben |
| GPS marca "(simulada)" | Sin permiso de ubicación o falló `getCurrentPositionAsync` | `device.ts` cae a `gpsMock()` a propósito, nunca bloquea el censo |
| **El modal de actualización nunca aparece** | Falla en silencio a propósito: servidor caído, `version.json` inválido, o `versionCode` remoto ≤ instalado | Probar `curl {UPDATE_URL}/version.json`; recordar que compara **`versionCode`**, no `versionName` |
| "No se pudo abrir el instalador" | Falta el permiso de Android 8+ "instalar apps desconocidas" | Usar el botón del propio modal, que abre esos ajustes |
| `npm run check` falla con `✗ …` | Se rompió una regla al modificar `rules.ts` o `version.ts` | Leer `esperado` vs `recibido` y corregir la función |
| `tsc --noEmit` falla tras agregar un método al contrato | Falta implementarlo en `mock.ts` o en `http.ts` | Ambos lados de `CensoApi`, siempre |

## Cómo depurar localmente — orden recomendado

1. **Reproducir con mock** (`USE_MOCK=true`) para descartar red/backend: todo el flujo de negocio
   funciona sin conexión.
2. **Aislar la regla**: si el bug parece de lógica (status, bloqueo, En Piso, avance), escribirlo
   primero como caso en `src/lib/rules.check.ts` — más rápido que recorrer la UI, y si queda como
   test permanente, mejor.
3. **Si es del backend**, loguear el `ApiError` completo (`status` + `body`) en el `catch` de la
   pantalla: el `title`/`errors` de RFC 7807 dice exactamente qué campo rechazó.
4. **Revisar el store antes que el componente**: `draft.tsx` (censo en construcción),
   `session.tsx` (ruta). Ojo: `records.tsx` ya casi no alimenta a nadie.
5. **Para hardware**: `device.ts` nunca lanza — si algo "no funciona", verificar si cayó
   silenciosamente al fallback `mock: true`.
6. **`npx expo start -c`** ante cualquier rareza con variables de entorno o assets.
7. **Para crashes nativos**: `adb logcat -b crash -d` (el error no aparece en Metro).

## Monitoreo

No aplica: sin dashboards, métricas ni alertas. La única señal en campo es el banner de red y los
`Alert.alert`.
