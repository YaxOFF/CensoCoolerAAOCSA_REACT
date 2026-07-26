/* Implementación REAL del contrato contra el backend de FROG.

   Está completa asumiendo que el backend responde exactamente los tipos de ./types.ts.
   Para activarla: EXPO_PUBLIC_USE_MOCK=false y EXPO_PUBLIC_API_URL=https://…

   Si el backend responde con otra forma (otros nombres de campo, envoltorio { data: … },
   fechas en otro formato), AQUÍ es donde se adapta — con una función de mapeo por método.
   Nunca en las pantallas. */

import { ApiError, request } from './client';
import type { CensoApi } from './contract';
import type {
  Catalogos,
  Enfriador,
  RegistroCenso,
  RegistroCensoInput,
  Reporte,
  Resumen,
  TipoFoto,
} from './types';

export const httpApi: CensoApi = {
  async lookupEnfriador(numeroSerie) {
    try {
      return await request<Enfriador>(`/enfriadores/${encodeURIComponent(numeroSerie.trim().toUpperCase())}`);
    } catch (e) {
      // 404 no es un error de la app: significa serie inexistente => status NUEVO (§5).
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  listRegistros() {
    return request<RegistroCenso[]>('/censos');
  },

  saveRegistro(input: RegistroCensoInput) {
    return request<RegistroCenso>('/censos', { method: 'POST', body: input });
  },

  getResumen() {
    return request<Resumen>('/censos/resumen');
  },

  getReporte() {
    return request<Reporte>('/censos/reporte');
  },

  subirFoto(uri: string, tipo: TipoFoto) {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('archivo', {
      uri,
      name: `${tipo.toLowerCase()}.jpg`,
      type: 'image/jpeg',
    } as any); // RN acepta este objeto como parte de un FormData multipart.
    return request<{ id: string; uri: string }>('/censos/fotos', { method: 'POST', form });
  },

  getCatalogos() {
    return request<Catalogos>('/catalogos');
  },

  async resetDemo() {
    // Con backend real no se borra nada: la limpieza solo existe en la demo.
  },
};
