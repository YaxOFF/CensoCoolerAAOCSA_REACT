/* ═══════════════════════════════════════════════════════════════════════════
   PUNTO ÚNICO DE CAMBIO entre mock y backend real.

   Todas las pantallas importan `api` desde aquí y solo llaman a los métodos del
   contrato. Ninguna sabe si detrás hay AsyncStorage o HTTP.

   Para conectar los endpoints reales:
     1. Copia .env.example a .env
     2. EXPO_PUBLIC_USE_MOCK=false
     3. EXPO_PUBLIC_API_URL=https://tu-backend/api
     4. Reinicia el bundler:  npx expo start -c
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CensoApi } from './contract';
import { httpApi } from './http';
import { mockApi } from './mock';
import { conOffline, iniciarOffline } from './offline';

/** Por defecto se usa mock: la app arranca sin backend. */
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

/* Con backend real, `api` va envuelta por el modo Sin Internet (./offline.ts): sin
   red lee el padrón descargado y encola los censos. El mock no lo necesita —ya es
   local— y así el envoltorio nunca estorba en la demo. */
export const api: CensoApi = USE_MOCK ? mockApi : conOffline(httpApi);

// Deja la cola y el padrón en memoria antes del primer render del banner y del modal.
if (!USE_MOCK) iniciarOffline();

export type { CensoApi };
export * from './types';
