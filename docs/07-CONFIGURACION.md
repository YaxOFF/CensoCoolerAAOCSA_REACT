# ⚙️ Cómo Corre

## Variables de entorno

Definidas en `.env` (no versionado; copiar desde `.env.example`). Prefijo `EXPO_PUBLIC_` porque
Expo solo embebe en el bundle las variables con ese prefijo — **nunca pongas secretos aquí**, quedan
visibles en el cliente.

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `EXPO_PUBLIC_USE_MOCK` | No | `true` (cualquier valor ≠ `'false'` cuenta como mock) | `true` → datos simulados en el dispositivo (`src/api/mock.ts`). `false` → llamadas HTTP reales (`src/api/http.ts`) |
| `EXPO_PUBLIC_API_URL` | Solo si `USE_MOCK=false` | `''` | URL base del backend, **sin diagonal final**. En Android físico debe ser la IP de la máquina de desarrollo, no `localhost` |

La lógica exacta vive en `src/api/index.ts`:
```ts
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
export const api: CensoApi = USE_MOCK ? mockApi : httpApi;
```

Si `USE_MOCK=false` y `EXPO_PUBLIC_API_URL` no está seteada, cualquier llamada a `api.*` lanza
`ApiError('EXPO_PUBLIC_API_URL no está configurada. Revisa tu archivo .env.', 0)` en vez de
intentar un `fetch` a una URL vacía (ver `src/api/client.ts:32`).

## Archivos de configuración

| Archivo | Controla |
|---|---|
| `.env` | Las dos variables de arriba (no versionado) |
| `.env.example` | Plantilla documentada, sí versionada |
| `app.json` | Nombre, slug, ícono, permisos nativos, plugins de Expo (cámara, ubicación, sharing) |
| `tsconfig.json` | `strict: true`, alias `@/*` → `src/*`, extiende `expo/tsconfig.base` |
| `package.json` | Scripts (`start`, `android`, `check`, `typecheck`) y dependencias |

## Entornos

No hay separación formal dev/staging/producción con archivos distintos (`.env.staging`, etc.). El
único "entorno" configurable es la dupla `USE_MOCK` / `API_URL`:

- **Desarrollo sin backend** (default): `USE_MOCK=true`. No requiere nada más; arranca con datos
  sembrados.
- **Desarrollo contra backend real**: `USE_MOCK=false` + `API_URL` apuntando al backend (local o
  remoto).
- **Producción**: se asume `USE_MOCK=false` + `API_URL` del backend productivo, mismo mecanismo.

## Conectar el backend real — paso a paso

1. `cp .env.example .env`
2. En `.env`: `EXPO_PUBLIC_USE_MOCK=false` y `EXPO_PUBLIC_API_URL=https://tu-backend/api`
3. **Reiniciar el bundler con caché limpia** (obligatorio — Expo cachea variables de entorno):
   ```bash
   npx expo start -c
   ```
4. Si el backend responde con una forma distinta a `src/api/types.ts` (otros nombres de campo,
   envoltorio `{ data: … }`, fechas en otro formato), el mapeo se agrega **dentro de**
   `src/api/http.ts`, en el método correspondiente — nunca en las pantallas.

## Backend corriendo en la PC de desarrollo

El `localhost` del teléfono es el teléfono, no la PC. Con el backend en local (p. ej.
`http://localhost:8090/api`) hay dos caminos:

**`adb reverse` — el recomendado.** Túnel por el cable USB; el `.env` se queda con `localhost` y no
hace falta tocar firewall ni saber la IP:

```bash
adb reverse tcp:8090 tcp:8090     # 8090 = el puerto de tu API
```

Se pierde al desconectar el cable, al reiniciar el teléfono y al reiniciar el `adb` server:
**hay que volver a correrlo**. Verificar con `adb reverse --list`, y probar desde el teléfono con:

```bash
adb shell "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8090/api/censos/resumen?ruta=1"
```

`401` ya es buena señal: llegó a la API y solo faltó el token. `000` / timeout = el túnel no está.

**IP de la LAN — la alternativa.** `EXPO_PUBLIC_API_URL=http://192.168.x.x:8090/api` (la IP de la PC,
vía `ip -4 addr`). Requiere que la API escuche en `0.0.0.0` (no solo `127.0.0.1`), que el firewall
deje pasar el puerto (en Fedora: `sudo firewall-cmd --add-port=8090/tcp`) y que ambos estén en la
misma red Wi‑Fi. Cambiar la URL obliga a reiniciar con `npx expo start -c`.

## Comandos esenciales

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm start` | Levanta el bundler de Expo (metro) |
| `npm run android` | Abre en el dispositivo/emulador Android conectado |
| `npm run ios` | Abre en simulador iOS (no es el foco del proyecto pero funciona) |
| `npm run web` | Abre en navegador |
| `npm run check` | Corre `src/lib/rules.check.ts` — verifica las reglas de negocio |
| `npm run typecheck` | `tsc --noEmit` — valida tipos en todo el proyecto |

No hay comandos de `build`, `migrate` ni `deploy` en `package.json`. Para un instalable Android hace
falta un dev build con EAS (`npx eas build -p android`), que también sería el paso hacia producción
— no configurado todavía en este repo.
