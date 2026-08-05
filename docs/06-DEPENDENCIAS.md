# 📦 El Ecosistema

## Dependencias principales

| Paquete | Versión | Dónde se usa |
|---|---|---|
| `expo` | ~57.0.8 | Runtime, toolchain de build y config unificada (`app.json`) |
| `expo-router` | ~57.0.8 | Navegación file-based: `Stack`, `Tabs`, `useRouter`, `useFocusEffect`, `useLocalSearchParams`, `Redirect` |
| `react` | 19.2.3 | UI declarativa |
| `react-native` | 0.86.0 | Runtime nativo (Android es el foco; iOS/web no se prueban) |
| `react-native-screens` | ~4.26.0 | Optimiza el montaje de pantallas nativas bajo expo-router |
| `react-native-safe-area-context` | ~5.7.0 | `SafeAreaProvider` en `_layout.tsx`; `useSafeAreaInsets` en `Screen`, `BannerRed`, `history.tsx` |
| `@react-native-async-storage/async-storage` | 2.2.0 | `censo_ruta` (sesión) y `censo_registros_v1` (mock) |
| `@react-native-community/netinfo` | 12.0.1 | `src/api/client.ts` — sondeo de `/health` para el banner de red |
| `expo-camera` | ~57.0.3 | `CameraView` para escanear el código de barras (`app/(tabs)/search.tsx`) |
| `expo-image-picker` | ~57.0.6 | `launchCameraAsync` para la evidencia (`src/lib/device.ts`) |
| `expo-location` | ~57.0.6 | GPS del levantamiento §12.3 (`src/lib/device.ts`) |
| `expo-file-system` | ~57.0.1 | Tres usos: `uploadAsync` (evidencias), `downloadAsync` (reporte), `File.downloadFileAsync` (APK) |
| `expo-sharing` | ~57.0.7 | Compartir el reporte descargado (`app/report.tsx`) |
| `expo-application` | ~57.0.2 | `nativeBuildVersion` / `applicationId` para la auto-actualización |
| `expo-intent-launcher` | ~57.0.1 | `INSTALL_PACKAGE` y ajustes de "apps desconocidas" (`src/api/updates.ts`) |
| `react-native-qrcode-svg` | ^6.3.21 | QR con la URL del reporte (`app/report.tsx`) |
| `react-native-svg` | ^15.15.4 | Peer de `react-native-qrcode-svg`; no se importa directo |
| `expo-status-bar` | ~57.0.1 | `<StatusBar style="auto" />` en `_layout.tsx` |
| `expo-constants` | ~57.0.7 | Transitiva de Expo/expo-router; no se importa en código propio |
| `expo-linking` | ~57.0.4 | Requerida por expo-router (deep linking); no se importa en código propio |
| `@expo/vector-icons` | ^15.0.2 | Ionicons en botones, tabs y estados |

### Declaradas pero sin usar

| Paquete | Situación |
|---|---|
| `expo-print` | **Sin un solo import en `app/` ni `src/`.** Se usaba para generar el PDF del reporte en el cliente; ahora el PDF lo genera el backend y devuelve una URL. Es un candidato claro a `npm uninstall`. |

`expo-constants`, `expo-linking` y `react-native-svg` tampoco se importan directo, pero **sí hacen
falta**: las dos primeras las requiere expo-router y la tercera es peer de `react-native-qrcode-svg`.

## Dependencias de desarrollo

| Paquete | Versión | Para qué |
|---|---|---|
| `typescript` | ~6.0.3 | Tipado estático; `tsc --noEmit` es el único chequeo de tipos |
| `@types/react` | ~19.2.2 | Tipos de React |

No hay ESLint, Prettier ni Jest. El único "test runner" es `npm run check`, que ejecuta
`src/lib/rules.check.ts` con Node puro (`node --experimental-strip-types`). Ver
[08-TESTING.md](08-TESTING.md).

## Los `overrides` de `package.json` — no tocar

```json
"overrides": {
  "react-native-reanimated": "4.5.0",
  "react-native-worklets": "0.10.0",
  "react-dom": "19.2.3"
}
```

`reanimated` y `worklets` entran como deps transitivas de `expo-router`, y su parte nativa
(`libworklets.so`) viene **compilada dentro del APK de Expo Go**. Expo Go SDK 57 trae exactamente
`4.5.0` / `0.10.0`.

> ⚠️ **Si se quitan o se suben esas versiones, la app crashea al arrancar en Expo Go sin ningún
> error en la consola de Metro** — el JS habla con un nativo que no coincide y el proceso muere con
> `SIGSEGV` dentro de `libworklets.so`. Diagnóstico:
> ```bash
> adb logcat -b crash -d | grep -E "signal|libworklets"
> node -p "require('./node_modules/expo/bundledNativeModules.json')['react-native-worklets']"
> node -p "require('./node_modules/react-native-worklets/package.json').version"   # deben coincidir
> ```

`react-dom` está pineado a la versión de `react` porque si no, cualquier `npm install` falla con
ERESOLVE. `@react-native-community/netinfo` va pineado a `12.0.1` por el mismo motivo que los
overrides (módulo nativo precompilado en Expo Go), aunque no necesita `overrides` porque es dep
directa.

Con un dev build propio esto deja de importar: ahí el nativo se compila desde `node_modules`.

## Servicios externos

| Servicio | Qué es | Variable |
|---|---|---|
| Backend del censo (FROG) | La API REST: coolers, evidencias, reportes | `EXPO_PUBLIC_API_URL` |
| Nginx de archivos | Sirve las imágenes de evidencias y los reportes generados | `EXPO_PUBLIC_IMG_URL` (solo para reapuntar el host) |
| Nginx de distribución | `version.json` + el `.apk` de cada release | `EXPO_PUBLIC_UPDATE_URL` (default `https://files.censo.aaocsa.com/app-release`) |

Sin colas de mensajes, sin caché externa, sin analytics, sin crash reporting.

## Infraestructura

- **Sin Docker**, sin CI/CD en el repo (no hay `.github/workflows`).
- **Sin EAS.** El APK se compila localmente con Gradle; el procedimiento está en `COMPILAR.md` y
  automatizado en `scripts/release.sh`. Ver [11-BUILD-Y-ACTUALIZACIONES.md](11-BUILD-Y-ACTUALIZACIONES.md).
- **`android/` no está en git** (`.gitignore`): lo genera `npx expo prebuild` desde `app.json`.
- **Distribución fuera de Play Store**: APK firmado con el `debug.keystore` del template de Expo,
  repartido por el Nginx propio y actualizado por la app misma. Keystore propio: pendiente.
- **Permisos nativos** declarados en `app.json`: cámara (`expo-camera`, `expo-image-picker`),
  ubicación (`expo-location`) con sus textos en español, y `REQUEST_INSTALL_PACKAGES` para la
  auto-actualización.
