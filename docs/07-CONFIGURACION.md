# ⚙️ Cómo Corre

## Variables de entorno

Definidas en `.env` (no versionado; copiar desde `.env.example`). Prefijo `EXPO_PUBLIC_` porque Expo
solo embebe en el bundle las variables con ese prefijo.

> ⚠️ **Todo lo que va en `EXPO_PUBLIC_*` queda legible dentro del APK**, token incluido. No es un
> canal para secretos. Y **se embebe al compilar**: revisar el `.env` *antes* de correr Gradle, no
> después.

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `EXPO_PUBLIC_USE_MOCK` | No | `true` (cualquier valor ≠ `'false'` cuenta como mock) | `true` → datos simulados (`src/api/mock.ts`); `false` → HTTP real (`src/api/http.ts`) |
| `EXPO_PUBLIC_API_URL` | Solo si `USE_MOCK=false` | `''` | URL base del backend, **sin diagonal final e incluyendo `/api`**. En Android físico, la IP de la máquina — no `localhost` |
| `EXPO_PUBLIC_API_TOKEN` | Solo si `USE_MOCK=false` | `null` | JWT que se manda como `Authorization: Bearer`. Todos los endpoints lo exigen |
| `EXPO_PUBLIC_IMG_URL` | No | `''` | Reescribe el host de las URLs de evidencias y reportes. Vacío = se usan tal cual (correcto en producción y con `adb reverse`) |
| `EXPO_PUBLIC_UPDATE_URL` | No | `https://files.censo.aaocsa.com/app-release` | Servidor donde viven `version.json` y el `.apk`. Sin diagonal final |

> ⚠️ **`EXPO_PUBLIC_API_URL` debe incluir el segmento `/api`.** Las rutas se concatenan tal cual
> (`${API_URL}/coolers`), así que una URL sin `/api` produce 404 en **todos** los endpoints, incluido
> el `/health` que sondea NetInfo — con lo cual además el banner rojo de "sin conexión" queda
> pegado aunque el backend esté vivo.

La lógica del interruptor (`src/api/index.ts`):

```ts
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
export const api: CensoApi = USE_MOCK ? mockApi : httpApi;
```

Si `USE_MOCK=false` y `EXPO_PUBLIC_API_URL` está vacía, cualquier llamada lanza
`ApiError('EXPO_PUBLIC_API_URL no está configurada. Revisa tu archivo .env.', 0)` en vez de intentar
un fetch a una URL vacía.

`USE_MOCK` además enciende ayudas de demo en la UI: chips de series de prueba y "Simular escaneo"
en Censar, el hint del Home y el botón "Borrar demo" en Historial.

## Archivos de configuración

| Archivo | Controla |
|---|---|
| `.env` | Las 5 variables de arriba (no versionado) |
| `.env.example` | Plantilla documentada, sí versionada |
| `app.json` | Nombre (`CensoCooler`), package (`com.censoenfriadores.app`), `version`, `versionCode`, íconos, permisos y plugins de Expo |
| `version.json` | Lo que se publica en el servidor de updates: `versionCode`, `versionName`, `apkUrl`, `whatsNew`, `forceUpdate` |
| `tsconfig.json` | `strict: true`, alias `@/*` → `src/*`, `allowImportingTsExtensions`, extiende `expo/tsconfig.base` |
| `package.json` | Scripts, dependencias y los `overrides` que no se tocan |

### `app.json` — opciones no-default y por qué están

| Opción | Valor | Por qué |
|---|---|---|
| `newArchEnabled` | `true` | Nueva arquitectura de RN (default del template SDK 57) |
| `android.package` | `com.censoenfriadores.app` | Identidad del APK; cambiarlo rompe la actualización sobre instalaciones existentes |
| `android.versionCode` | `4` | **Es lo que compara la auto-actualización**, no el `version` |
| `android.permissions` | `REQUEST_INSTALL_PACKAGES` | Único permiso declarado a mano; lo exige el instalador del APK |
| `android.edgeToEdgeEnabled` | `true` | Contenido bajo las barras del sistema; por eso los `useSafeAreaInsets` |
| `android.predictiveBackGestureEnabled` | `false` | El gesto predictivo de atrás pelearía con el modal de actualización forzada |
| `plugins` de cámara/imagen/ubicación | textos en español | Son los mensajes del diálogo de permiso del sistema |
| `scheme` | `censoenfriadores` | Deep linking de expo-router |

> ⚠️ **`android/` se regenera con `expo prebuild` y no está en git.** Nunca edites
> `android/app/build.gradle` ni el manifest a mano: el siguiente prebuild los pisa. Lo que se toca
> es `app.json`.

## Entornos

No hay `.env.staging` ni perfiles: el único "entorno" es la dupla `USE_MOCK` / `API_URL`.

- **Desarrollo sin backend** (default): `USE_MOCK=true`. Arranca con datos sembrados, sin red.
- **Desarrollo contra backend real**: `USE_MOCK=false` + `API_URL` + `API_TOKEN`.
- **Producción**: lo mismo, con la URL productiva, compilado en el APK.

## Conectar el backend real — paso a paso

1. `cp .env.example .env`
2. En `.env`: `EXPO_PUBLIC_USE_MOCK=false`, `EXPO_PUBLIC_API_URL=https://tu-backend/api` y el token.
3. **Reiniciar el bundler con caché limpia** (obligatorio — Metro cachea las `EXPO_PUBLIC_*`):
   ```bash
   npx expo start -c
   ```
4. Si el backend responde con otra forma (otros nombres de campo, envoltorio `{data: …}`, fechas en
   otro formato), el mapeo se agrega **dentro de** `src/api/http.ts`, en el método correspondiente —
   nunca en las pantallas.

## Backend corriendo en la PC de desarrollo

El `localhost` del teléfono es el teléfono, no la PC. Dos caminos:

**`adb reverse` — el recomendado.** Túnel por el cable USB; el `.env` se queda con `localhost` y no
hace falta tocar firewall ni saber la IP:

```bash
adb reverse tcp:8091 tcp:8091     # 8091 = el puerto de tu API
```

Se pierde al desconectar el cable, al reiniciar el teléfono y al reiniciar el server de `adb`:
**hay que volver a correrlo**. Verificar con `adb reverse --list`, y probar desde el teléfono:

```bash
adb shell "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8091/api/health"
```

`200` = todo bien. `401` = llegó a la API y solo faltó el token. `000` / timeout = el túnel no está.

**IP de la LAN — la alternativa.** `EXPO_PUBLIC_API_URL=http://192.168.x.x:8091/api`. Requiere que
la API escuche en `0.0.0.0`, que el firewall deje pasar el puerto y que ambos estén en la misma
Wi-Fi. Cambiar la URL obliga a reiniciar con `npx expo start -c`.

**Imágenes que no cargan**: si el backend emite las URLs de evidencias con su propio host (típico
`localhost`), el teléfono no las resuelve. Ahí entra `EXPO_PUBLIC_IMG_URL` con el host alcanzable;
`http.ts` reescribe el host de cada `url`. Con `adb reverse` no hace falta.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (respeta los `overrides`) |
| `npm start` | Levanta el bundler de Expo (Metro) |
| `npm run android` | `expo run:android` sobre el dispositivo/emulador conectado |
| `npm run ios` / `npm run web` | Existen en `package.json`; no son el foco y no se prueban |
| `npm run check` | Corre `src/lib/rules.check.ts` — verifica reglas de negocio y el parser de versión |
| `npm run typecheck` | `tsc --noEmit` |
| `./scripts/release.sh [patch\|minor\|major\|X.Y.Z] ["changelog"]` | Sube versión y compila el APK de release |

No hay comandos de `migrate` ni `deploy`. El build está fuera de `package.json` a propósito: vive en
`scripts/release.sh` porque necesita JDK 17 y el Android SDK, no solo Node.
