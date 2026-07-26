# Censo de Enfriadores

App móvil (Expo / React Native, Android) para el censo nacional de enfriadores: escaneo de la serie,
consulta a FROG, validación de datos, preguntas del censo con fotos y GPS, historial, dashboard de
avance y reporte corporativo exportable a Excel y PDF.

## Arrancar

```bash
npm install
npm start          # luego escanea el QR con Expo Go, o presiona 'a' para Android
```

Arranca con datos simulados: no hace falta backend. Series de prueba: `IMB-100238`, `MTF-559012`,
`OJE-778341`. Cualquier otra serie se registra como equipo **NUEVO**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Bundler de Expo |
| `npm run android` | Abre en el dispositivo o emulador Android conectado |
| `npm run check` | Verifica las reglas de negocio del censo |
| `npm run typecheck` | `tsc --noEmit` |

## Conectar el backend

```bash
cp .env.example .env
# EXPO_PUBLIC_USE_MOCK=false
# EXPO_PUBLIC_API_URL=https://tu-backend/api
npx expo start -c
```

Los endpoints esperados están documentados en `src/api/contract.ts` e implementados en
`src/api/http.ts`.

## Documentación

`CLAUDE.md` tiene el detalle: reglas de negocio, estructura del proyecto, convenciones y cómo hacer
los cambios más comunes.
