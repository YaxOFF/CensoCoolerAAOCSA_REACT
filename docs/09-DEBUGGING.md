# 🐛 Cuando algo Falla

## Logs

No hay sistema de logging estructurado ni servicio externo (Sentry, etc.) integrado. Los canales
disponibles:

- **Consola de Metro** (`npm start`): `console.*` y errores no capturados de JS/React.
- **Errores de red**: todos pasan por `ApiError` (`src/api/client.ts`), con `message`, `status` y
  `body` — inspeccionables en cualquier `catch` o con un `console.error(e)` temporal.
- **Errores de usuario**: se muestran con `Alert.alert(...)` en vez de solo loguearse — es la
  política del proyecto ("los estados de carga y error se muestran, no se tragan").
- **Logcat de Android** (`adb logcat`) para errores nativos por debajo de JS (permisos, cámara,
  crashes del runtime).

## Monitoreo

No aplica: no hay app en producción con usuarios reales todavía, ni dashboards de métricas/alertas
configurados.

## Errores comunes y soluciones

| Síntoma | Causa probable | Solución |
|---|---|---|
| **La app se cierra sola al abrir, sin error en Metro** | Versión de `react-native-worklets`/`reanimated` distinta a la que Expo Go trae compilada → `SIGSEGV` en `libworklets.so` | Restaurar los `overrides` de `package.json` y `npm install`. Ver *No tocar: los `overrides` de package.json* en `CLAUDE.md` |
| Cambié `.env` y no pasó nada | Metro cachea variables `EXPO_PUBLIC_*` | `npx expo start -c` (caché limpia) |
| `EXPO_PUBLIC_API_URL no está configurada` | `USE_MOCK=false` sin `API_URL`, o `.env` no existe | Verificar `.env` (copiado de `.env.example`) y reiniciar con `-c` |
| Timeout / "El servidor no respondió a tiempo" en Android físico | `API_URL=http://localhost:...` — el teléfono no ve el localhost de la PC | Usar la IP LAN de la máquina de desarrollo, no `localhost` |
| Formulario no deja editar campos de cliente/equipo | Es esperado si `status === 'CORRECTO'` (§6) | Revisar `draft.status`; solo `CORRECCIÓN`/`NUEVO` habilitan edición |
| Cliente se ve forzado a "BODEGA" y no se puede tocar | Estado del enfriador = "En Piso" (§12.2), comportamiento intencional | Cambiar el estado a otro valor para restaurar el cliente previo |
| "Guardar censo" no hace nada visible | `validarDraft()` bloqueó por falta de estado del enfriador u otro campo obligatorio | Revisar el `Alert.alert` que debió aparecer; completar el campo faltante |
| Historial/Dashboard no reflejan un censo recién guardado | Poco probable — `guardar()` llama `refrescar()` automáticamente | Verificar que `saveRegistro` no haya lanzado (revisar `try/catch` en `onGuardar`); pull-to-refresh en Historial como workaround manual |
| Escáner no abre / cámara negra | Permiso de cámara denegado | Revisar permisos del SO para la app; `search.tsx` cae a captura manual o "Simular escaneo" (solo con `USE_MOCK`) |
| Foto se ve como un cuadro de color en vez de la imagen real | Es una foto simulada (`mock://…`) porque no hubo permiso de cámara al capturarla | Revisar permisos; comportamiento esperado en emulador sin cámara |
| GPS marca "(simulada)" | Sin permiso de ubicación o falló `getCurrentPositionAsync` | Revisar permisos de ubicación; `device.ts` cae a `gpsMock()` a propósito, nunca bloquea el censo |
| `npm run check` falla con `✗ …` | Se rompió una regla de negocio al modificar `rules.ts` | Leer el mensaje (`esperado` vs `recibido`), corregir la función señalada en `src/lib/rules.ts` |
| `tsc --noEmit` falla tras agregar un campo | Falta actualizar `mock.ts` y/o `http.ts` para implementar el nuevo método/campo del contrato | Implementar en ambos lados de `CensoApi` (regla dura del contrato) |
| Exportar CSV/PDF no hace nada / error "no permite compartir archivos" | Dispositivo/emulador sin app para manejar el share sheet | Probar en dispositivo físico o revisar `Sharing.isAvailableAsync()` |
| Acentos rotos al abrir el CSV en Excel | No debería pasar — `construirCsv()` antepone BOM | Confirmar que se está usando `construirCsv()` y no un CSV armado a mano |

## Cómo debuggear localmente — pasos recomendados

1. **Reproducir con mock** (`USE_MOCK=true`, default) para descartar que sea un problema de red o
   backend — todo el flujo de negocio es reproducible sin conexión.
2. **Aislar la regla de negocio**: si el bug parece de lógica (status, bloqueo de campos, En Piso,
   cálculo de avance), reproducirlo como caso en `src/lib/rules.check.ts` primero — es más rápido
   que recorrer la UI cada vez, y si se convierte en test permanente mejor.
3. **Revisar el store correspondiente** antes que el componente: `draft.tsx` para el censo en
   construcción, `records.tsx` para lo persistido, `session.tsx` para la ruta.
4. **Para errores de red**: loguear temporalmente el `ApiError` completo (`status`, `body`) en el
   `catch` de la pantalla — casi siempre el `body` trae más contexto que el `message` genérico.
5. **Para hardware (GPS/cámara)**: recordar que `src/lib/device.ts` nunca lanza — si algo "no
   funciona" ahí, revisar si cayó silenciosamente al fallback `mock: true` en vez de asumir un
   crash.
6. **`npx expo start -c`** como primer paso ante cualquier comportamiento raro relacionado con
   variables de entorno o assets — la caché de Metro es la causa más común de "no debería pasar
   esto".
