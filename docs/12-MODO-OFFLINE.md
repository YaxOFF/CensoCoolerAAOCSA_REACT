# 📴 Modo Sin Internet

Documento de mantenimiento del modo offline. Si vas a **modificar, depurar o extender** esta
funcionalidad, empieza aquí: dice qué hace cada pieza, por qué está donde está, y cuáles son las
trampas que ya se pisaron.

Resumen en una línea: **perder señal no puede detener la jornada del inspector.**

- Vista rápida en el flujo: [03-FLUJOS.md § Flujo 5](03-FLUJOS.md)
- Vista de capas: [02-ARQUITECTURA.md § Modo Sin Internet](02-ARQUITECTURA.md)
- Reglas de negocio puras: `src/lib/rules.ts`, verificadas por `npm run check`

---

## 1. Qué hace, en orden

1. **Precarga.** Al enfocar la pestaña **Inicio**, la app descarga el padrón de FROG de la ruta y lo
   guarda en AsyncStorage.
2. **Detección.** Cuando NetInfo deja de alcanzar `{API_URL}/health`, un modal pregunta si se quiere
   pasar al **modo Sin Internet**.
3. **Captura offline.** Con el modo activo, buscar una serie consulta la copia local y guardar un
   censo lo **encola** en el teléfono en vez de mandarlo.
4. **Visibilidad.** Los encolados salen **en rojo** en el Historial y un banner permanente muestra el
   modo y cuántos faltan por enviar, en cualquier pantalla.
5. **Reconexión.** Al confirmarse la red el modo se apaga solo; **el envío no es automático**.
6. **Envío.** El botón *Enviar pendientes* del Historial sincroniza y reporta qué pasó con cada uno.

---

## 2. Las cinco decisiones de producto (y por qué)

Están tomadas con el usuario. **Si te piden cambiar una, cámbiala aquí y en el código, no la
"interpretes" distinto en una pantalla.**

| # | Decisión | Por qué | Dónde vive |
|---|---|---|---|
| 1 | Serie que no está en el padrón descargado ⇒ **se bloquea**, igual que en línea (§4) | Casi siempre es un error de captura, no un equipo faltante. Permitir censarlo como NUEVO ensuciaría FROG con duplicados que después hay que depurar a mano | `offline.ts › lookupEnfriador` devuelve `null`; el bloqueo sigue en `search.tsx` |
| 2 | Al volver la red el modo **se apaga solo**; el envío es **manual** | Un fallo de envío tiene que verse en el momento. Sincronizar en segundo plano esconde errores hasta que ya no hay forma de reconstruir el dato | `offline.ts › apagarSiVolvioLaRed` + botón en `history.tsx` |
| 3 | **No hay switch manual** del modo | Menos superficie, y sobre todo: nadie queda offline sin darse cuenta | Solo `ModalOffline.tsx` puede activarlo |
| 4 | La precarga ocurre **solo al entrar a Inicio** | Un único punto de descarga, para que el inspector sepa exactamente dónde se refrescan sus datos | `app/(tabs)/index.tsx › descargarPadron` |
| 5 | **Sin padrón no se ofrece activar** el modo | Activar sin datos deja al inspector sin poder buscar ninguna serie: sería un modo que no sirve para nada. Mejor explicar qué hacer | `ModalOffline.tsx`, rama `!off.hayPadron` |

---

## 3. Mapa de archivos

```
src/api/offline.ts          ← TODO el modo offline. 380 líneas. Empieza acá.
src/api/index.ts            api = USE_MOCK ? mockApi : conOffline(httpApi)
src/api/client.ts           redConfirmada(): el 'ok' comprobado vs. el del arranque
src/api/http.ts             exporta mapFrog() para que offline.ts mapee el padrón igual
src/api/types.ts            Cooler.pendienteEnvio / .errorEnvio · RegistroCenso.pendienteEnvio

src/lib/rules.ts            serieNormalizada · pendienteAFilaCooler · faltantesSinCola  (PURAS)
src/lib/rules.check.ts      sus asserts (npm run check)

src/ui/ModalOffline.tsx     el "¿quieres cambiar al modo Sin Internet?"
src/ui/BannerRed.tsx        banner permanente (red + modo + pendientes)

app/_layout.tsx             monta <ModalOffline/> junto a <BannerRed/> y <ModalActualizacion/>
app/(tabs)/index.tsx        precarga + línea de estado "Sin conexión: N equipos · fecha"
app/(tabs)/history.tsx      filas rojas, botón Enviar pendientes, aviso en el detalle
app/(tabs)/search.tsx       mensaje distinto cuando la serie no está en el padrón local
app/censo/done.tsx          "se guardó en el teléfono" en vez de "Censado = SI"
```

### Por qué las pantallas importan `@/api/offline` directamente

Contradice a medias la regla dura *"las pantallas solo llaman a `api.*`"*, y es deliberado:
`precargarPadron`, `sincronizar` y el estado observable **no son datos del dominio**, son control de
la capa de transporte. Meterlos en `contract.ts` obligaría a `mock.ts` a implementar una cola que no
necesita (el mock ya es local).

Hay precedente en el repo: `BannerRed.tsx` importa `@/api/client` y `ModalActualizacion.tsx` importa
`@/api/updates`. Lo que **sigue prohibido** es que un `.tsx` haga `fetch` o toque AsyncStorage.

---

## 4. Estado y persistencia

### El estado observable

Mismo patrón que el estado de red: un store externo mínimo consumido con `useSyncExternalStore`.

```ts
interface EstadoOffline {
  modo: boolean;            // el inspector está capturando contra la copia local
  pendientes: number;       // censos en cola
  hayPadron: boolean;
  padronFecha: string | null;
  padronTotal: number;
  padronRuta: string | null;
}

suscribirOffline(f) / leerEstadoOffline()
```

> ⚠️ `leerEstadoOffline()` **debe devolver la misma referencia** mientras nada cambie —
> `useSyncExternalStore` entra en bucle infinito si no. Por eso `publicar()` compara campo por campo
> y solo reemplaza el objeto cuando algo cambió de verdad. **No devuelvas un objeto nuevo ahí.**

### Las tres claves de AsyncStorage

| Clave | Forma | Quién escribe |
|---|---|---|
| `censo_offline_padron` | `{ ruta, udn, guardado: ISO, frog: FrogRow[], faltantes: FrogRow[], resumen: Resumen \| null, catalogos: Catalogos \| null }` | `precargarPadron()` |
| `censo_offline_cola` | `Pendiente[]` = `{ id, input: RegistroCensoInput, creado: ISO, error?: string \| null }` | `saveRegistro()` offline y `sincronizar()` |
| `censo_offline_modo` | `'1'` / `'0'` | `activarModoOffline()` / `desactivarModoOffline()` |

El padrón y la cola además viven **cacheados en memoria** (`let padron`, `let cola`): se leen en cada
listado y cada lookup, y AsyncStorage es asíncrono. `iniciarOffline()` los rehidrata al arrancar
(lo llama `src/api/index.ts` cuando `!USE_MOCK`).

`censo_offline_modo` sobrevive al reinicio a propósito: si la app se cierra en medio del campo sin
señal, vuelve donde iba.

> JSON corrupto se trata como "no hay nada" (`leerJson` traga el error). Reventar ahí dejaría al
> inspector sin app en vez de sin caché.

---

## 5. El envoltorio, método por método

`conOffline(base)` devuelve un `CensoApi`. **Con `modo === false` casi todo delega tal cual.**

| Método | Modo ON | Modo OFF |
|---|---|---|
| `lookupEnfriador` | Busca en `padron.frog` con `serieNormalizada` (tolera el prefijo `C_`) y devuelve `mapFrog(...)`. Sin padrón ⇒ `ApiError`. No encontrada ⇒ `null` (decisión 1) | delega |
| `listFrog` | `padron.frog`. Sin padrón ⇒ `ApiError` | delega |
| `listFaltantes` | `faltantesSinCola(padron.faltantes, series de la cola)` | delega |
| `listRutas` | Rutas únicas del padrón. Sin padrón ⇒ `[]` (el selector muestra su vacío) | delega |
| `listCoolers` | Solo la cola, filtrada por `q.serie`. `totalCount` = tamaño de la cola | **delega + antepone la cola en `page === 1`** |
| `listRegistros` | La cola como `RegistroCenso[]` | **cola + lo del servidor** |
| `saveRegistro` | Resguarda fotos, encola con upsert por serie, devuelve `pendienteEnvio: true` | delega |
| `getResumen` | El resumen cacheado ajustado con la cola. Sin caché ⇒ `ApiError` | delega |
| `getCatalogos` | Los cacheados; sin ellos, las constantes del dominio | delega |
| `getReporte` / `generarReporte` | `ApiError` explicando que necesita conexión | delega |
| `resetDemo` | delega (no-op con backend real) | delega |

### Los dos que NO son transparentes con red

`listCoolers` y `listRegistros` mezclan la cola **aunque haya conexión**. Es a propósito: mientras
algo no haya llegado al servidor tiene que verse. Dos detalles:

- Los pendientes se anteponen **solo en `page === 1`**. Mezclarlos en todas las páginas rompería el
  conteo del paginador, que viene del servidor.
- El `totalCount` del servidor se deja **intacto**. La cola no le suma.

### Por qué el upsert también en la cola

`saveRegistro` offline hace upsert por serie (§8), igual que el servidor. Censar dos veces el mismo
equipo sin red tiene que dejar **un** pendiente; si no, al sincronizar el primero pasa y el segundo
choca con el 409 y el inspector ve un "fallo" que no lo es.

---

## 6. Ciclo de vida de las fotos

**Este es el punto más frágil de todo el modo offline. No lo simplifiques.**

```
ImagePicker  →  cacheDirectory        ← Android lo puede VACIAR cuando falta espacio
   ↓ saveRegistro (modo ON)
copyAsync    →  documentDirectory/censo-pendiente/<id>-<i>-<tipo>.jpg
   ↓ sincronizar → POST /coolers/:id/evidencias
deleteAsync  →  se borra solo tras 2xx o 409
```

- Un censo encolado puede pasar **horas** esperando. Dejar sus evidencias en la caché es perderlas.
- Si `copyAsync` falla se conserva la `uri` original: el censo se manda igual, quizá sin esa foto,
  antes que perder el censo entero.
- `borrarFotos` solo borra lo que está **dentro** de `censo-pendiente/`: nunca toca un archivo del
  usuario ni una foto ya subida.
- Las fotos simuladas (`mock://`, ver `lib/device.ts`) no se copian ni se suben.

---

## 7. Sincronización

```ts
sincronizar(): Promise<{ enviados, yaRegistrados, fallidos: [{serie, error}] }>
```

Recorre la cola llamando `httpApi.saveRegistro` **uno por uno** (no en paralelo: son subidas de
fotos por 3G de CEDIS).

| Respuesta | Qué pasa |
|---|---|
| **2xx** | Sale de la cola, se borran sus fotos. Cuenta como *enviado*. |
| **409** | Sale de la cola igual: significa "esa serie ya está censada en la ronda vigente", o sea que **ya está en el servidor**. Cuenta aparte como *ya registrado*. Reintentarlo eternamente solo trabaría el envío. |
| Cualquier otro | **Se queda en la cola** con `error` = mensaje del backend, visible en el detalle del Historial. |

> ⚠️ **La cola se recalcula al final sobre la vigente, no sobre la foto del inicio.**
> Enviar tarda (van fotos) y la red se puede caer a media sincronización: el inspector activa el modo
> y encola otro censo. Guardar la lista de hace tres minutos lo borraría. Por eso se resuelve por
> `id` con un `Set` de resueltos y un `Map` de errores, y al final se filtra `cola`, no el snapshot.

---

## 8. Cómo se apaga el modo (y el bug que ya se arregló)

`client.ts` arranca con `backendAlcanzable = true` **de forma optimista**: todavía no contestó nadie.
Con eso solo, una app abierta *con* internet y el modo guardado en `'1'` nunca habría salido del
modo, porque el estado derivado no "cambia" y `notificar()` solo avisaba en cambios.

Arreglo: `client.ts` expone `redConfirmada()`.

```ts
// client.ts
let confirmada = false;              // ¿ya contestó NetInfo o alguna petición?
export function redConfirmada(): boolean

function notificar(confirma = false) // avisa también en la PRIMERA confirmación,
                                     // aunque el estado derivado no cambie
```

`notificar(true)` se llama desde: el listener de NetInfo (solo si `isInternetReachable !== null`),
y las dos salidas de `request()` (éxito y fallo).

```ts
// offline.ts
function apagarSiVolvioLaRed() {
  if (estado.modo && redConfirmada() && leerEstadoRed() === 'ok') desactivarModoOffline();
}
suscribirRed(apagarSiVolvioLaRed);   // por si la confirmación llega después
// y otra vez al final de iniciarOffline(), por si llegó ANTES de leer AsyncStorage
```

Sin `redConfirmada()`, una app que abre sin señal saldría del modo antes del primer sondeo.

---

## 9. A prueba de errores — inventario completo

Requisito explícito del usuario: **en cada punto donde algo no se pueda hacer, el inspector debe leer
qué pasó y qué hacer.** Si agregas un camino nuevo, agrégale su mensaje.

| Situación | Qué ve | Dónde |
|---|---|---|
| Se cae la red y hay padrón | Modal ofreciendo el modo, con cuántos equipos y de cuándo | `ModalOffline.tsx` |
| Se cae la red y **no** hay padrón | Modal que explica que hay que precargar desde Inicio (no ofrece activar) | `ModalOffline.tsx` |
| Precarga fallida | Línea roja en Inicio con el motivo + botón *Reintentar* | `(tabs)/index.tsx` |
| Serie no está en el padrón | Alerta aclarando que se buscó en la copia descargada de su ruta | `(tabs)/search.tsx` |
| Censo guardado sin red | `done.tsx` dice "se guardó en el teléfono" + fila `Envío: Pendiente` | `censo/done.tsx` |
| Hay pendientes | Banner morado (modo ON) o ámbar (con red) con el conteo, en toda la app | `BannerRed.tsx` |
| Pendiente en el listado | Punto rojo, serie en rojo, tag "Sin enviar" | `(tabs)/history.tsx › FilaCooler` |
| Detalle de un pendiente | Bloque rojo "Sin enviar al servidor" con el motivo si lo hubo | `(tabs)/history.tsx › DetalleModal` |
| Botón de envío no disponible | Se deshabilita y un `Muted` dice por qué (modo activo / sin conexión) | `(tabs)/history.tsx` |
| Envío parcial | `Alert` "Envío incompleto" con enviados / ya registrados / fallidos y motivo de cada uno | `(tabs)/history.tsx › enviarPendientes` |
| Envío fallido | El censo **sigue** en la cola, no se pierde | `offline.ts › sincronizar` |
| Reporte o Dashboard sin red | `ApiError` con texto explicando que hay que enviar los pendientes primero | `offline.ts` |
| App cerrada a media jornada | Cola, padrón y modo siguen en AsyncStorage; fotos en `documentDirectory` | — |

---

## 10. Cómo hacer cambios comunes

| Quiero… | Dónde toco |
|---|---|
| Cambiar qué se precarga | `offline.ts › precargarPadron` — el `listFrog` es obligatorio, el resto va en `Promise.all` con `.catch(() => …)` a propósito |
| Que la precarga no corra en cada foco | `(tabs)/index.tsx › descargarPadron`: `if (Date.now() - Date.parse(off.padronFecha) < 30*60_000) return` |
| Permitir censar series fuera del padrón | Revierte la decisión 1: `lookupEnfriador` offline tendría que devolver un `Enfriador` vacío en vez de `null`, y `search.tsx` avisar en vez de bloquear |
| Sincronizar solo al volver la red | `offline.ts › apagarSiVolvioLaRed`, llamar `sincronizar()` ahí. **Ojo: contradice la decisión 2**; primero confírmalo con el usuario |
| Agregar un switch manual del modo | Expón `activarModoOffline()` en Inicio. Contradice la decisión 3 |
| Cambiar el color o el texto del banner | `BannerRed.tsx › mensaje()` — el orden de los `if` **es** la prioridad |
| Cambiar cómo se dibuja un pendiente | `(tabs)/history.tsx › FilaCooler` (lista) y `pendienteAFilaCooler` en `rules.ts` (los datos) |
| Agregar un campo al censo | Igual que siempre (`types.ts` → `form.tsx` → `http.ts`) **y además** en `pendienteAFilaCooler` si tiene que verse en el Historial offline |
| Que la cola sobreviva a un cambio de ruta | Hoy sobrevive: la cola no se borra al hacer `salir()`. Si eso deja de convenir, `session.tsx › salir()` |

---

## 11. Trampas conocidas

1. **`leerEstadoOffline()` tiene que devolver la misma referencia.** Ver § 4.
2. **`serieNormalizada` no es opcional.** FROG emite las series con prefijo `C_` y el censo usa la
   serie desnuda; comparar en crudo deja equipos como "faltantes" para siempre. Es una función pura
   en `rules.ts` y `history.tsx` la reusa (`const sinPrefijo = serieNormalizada`).
3. **`pendienteAFilaCooler` manda valores del *dominio*, no enums del backend** (`'CORRECCIÓN'`,
   `'En Piso'`). Funciona porque `statusColor()` y `estadoColor()` normalizan acentos y guiones
   bajos. Si algún día dejan de normalizar, esto se rompe en silencio (todo gris).
4. **La precarga corre en cada foco de Inicio.** Cuatro llamadas cada vez que el inspector toca la
   pestaña. Es lo pedido (decisión 4), pero con red mala se nota.
5. **`getResumen` offline es una estimación**, no la verdad: suma la cola al último resumen cacheado.
   Puede desviarse si el servidor cambió por otro lado.
6. **El modo offline no se activa nunca con `EXPO_PUBLIC_USE_MOCK=true`.** `index.ts` solo envuelve a
   `httpApi`. Para probarlo hace falta backend real (o al menos una `API_URL` que falle).
7. **NetInfo sigue sondeando `/health` cada 5 s con el modo activo.** Es lo que permite apagarlo
   solo; cuesta batería, y es a propósito.

---

## 12. Cómo probarlo

```bash
npm run check       # asserts de pendienteAFilaCooler, faltantesSinCola y serieNormalizada
npm run typecheck
npx expo start -c
```

En el teléfono, con `EXPO_PUBLIC_USE_MOCK=false` y backend alcanzable:

1. Abrir **Inicio** con red → la línea de estado muestra N equipos descargados.
2. **Modo avión** → a los ≤5 s aparece el modal; activar. Banner morado.
3. **Censar** una serie del padrón → confirmación con el aviso de pendiente.
4. Buscar una serie inventada → alerta que menciona el padrón descargado.
5. **Historial** → fila roja "Sin enviar"; botón de envío deshabilitado con su explicación.
6. **Reporte** → mensaje de que necesita conexión.
7. Quitar el modo avión → el banner pasa a ámbar (el modo se apagó solo).
8. **Historial → Enviar pendientes** → `Alert` con el resultado; la fila deja de estar en rojo y sus
   fotos aparecen como evidencias.
9. Censar dos veces la misma serie offline y enviar → debe reportarse como **"ya registrado"** (409)
   y salir de la cola, no quedarse trabado.
10. App recién instalada, sin red → el modal debe explicar que no hay datos descargados.

Diagnóstico en campo:

```bash
adb logcat -b main -d | grep ReactNativeJS     # errores JS reales
# Ver la cola desde el debugger:  AsyncStorage.getItem('censo_offline_cola')
```
