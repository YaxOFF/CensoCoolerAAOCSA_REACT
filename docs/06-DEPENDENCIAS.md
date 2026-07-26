# 📦 El Ecosistema

## Dependencias principales

| Paquete | Versión | Para qué se usa |
|---|---|---|
| `expo` | ~57.0.8 | Runtime, toolchain de build y config unificada (`app.json`) |
| `expo-router` | ~57.0.8 | Navegación file-based: cada archivo en `app/` es una ruta; provee `Stack`, `Tabs`, `useRouter`, `useFocusEffect`, `Redirect` |
| `react` | 19.2.3 | UI declarativa |
| `react-native` | 0.86.0 | Runtime nativo (Android; iOS/web no son foco actual) |
| `react-native-screens` | ~4.26.0 | Optimiza el montaje de pantallas nativas bajo expo-router |
| `react-native-safe-area-context` | ~5.7.0 | Respeta notch/barra de estado (`SafeAreaProvider` en `app/_layout.tsx`) |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistencia clave-valor local: registros censados (mock) y sesión (ruta) |
| `expo-camera` | ~57.0.3 | `CameraView` para escanear código de barras/QR de la serie |
| `expo-image-picker` | ~57.0.6 | Captura de la evidencia fotográfica (3 fotos por censo) |
| `expo-location` | ~57.0.6 | GPS del levantamiento (sello automático, §12.3) |
| `expo-print` | ~57.0.1 | Genera el PDF del reporte corporativo desde HTML |
| `expo-file-system` | ~57.0.1 | Escribe el CSV exportado en el sistema de archivos del dispositivo |
| `expo-sharing` | ~57.0.7 | Comparte el CSV/PDF generado (share sheet nativo) |
| `expo-constants` | ~57.0.7 | Metadatos de la app en runtime (usado transitivamente por Expo) |
| `expo-linking` | ~57.0.4 | Deep linking (requerido por expo-router) |
| `expo-status-bar` | ~57.0.1 | Control del estilo de la barra de estado (`<StatusBar style="auto" />`) |
| `@expo/vector-icons` | ^15.0.2 | Iconografía (Ionicons) usada en botones, tabs y estados |

## Dependencias de desarrollo

| Paquete | Versión | Para qué |
|---|---|---|
| `typescript` | ~6.0.3 | Tipado estático; `tsc --noEmit` es el único "linter/test" de tipos |
| `@types/react` | ~19.2.2 | Tipos de React |

No hay ESLint, Prettier, Jest, ni ningún framework de test configurado en `package.json`. El único
"test runner" es un script propio (`npm run check`) que ejecuta `src/lib/rules.check.ts` con Node
puro (`node --experimental-strip-types`). Ver `08-TESTING.md`.

## Servicios externos

Ninguno integrado todavía. El proyecto está diseñado para conectar **un** backend HTTP propio
(FROG real) cuando exista — no hay colas de mensajes, cachés externas, ni storage tipo S3. La
"nube" hoy es exclusivamente el dispositivo del inspector (`AsyncStorage` + sistema de archivos
local vía `expo-file-system`).

## Infraestructura

- **Sin Docker.** No hay contenedores; el proyecto es un cliente móvil puro.
- **Sin CI/CD configurado** en este repo (no hay `.github/workflows` ni equivalente).
- **Hosting**: no aplica — es una app instalable, no un servicio desplegado.
- **Build/distribución**: Expo Go cubre desarrollo completo. Para un APK instalable o producción se
  necesita un dev build / build de producción con **EAS** (`npx eas build -p android`), no
  configurado aún en el repo (sin `eas.json`).
- **Variables de entorno críticas**: `EXPO_PUBLIC_USE_MOCK`, `EXPO_PUBLIC_API_URL` — ver
  `07-CONFIGURACION.md`.
- **Permisos nativos** declarados en `app.json` vía plugins: cámara (`expo-camera`,
  `expo-image-picker`) y ubicación (`expo-location`), cada uno con su texto de justificación en
  español para el diálogo de permiso del sistema.
