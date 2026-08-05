/* Rutas de FROG por CEDIS, cargadas bajo demanda: son decenas por UDN y casi nunca
   se necesitan, así que no vale la pena pedirlas al arrancar la pantalla.
   Lo usan el login y el formulario del censo con la misma mecánica. */

import { useState } from 'react';

import { api } from '@/api';

export function useRutas() {
  const [rutas, setRutas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  // UDN ya consultada: al reabrir el selector no se vuelve a pedir lo mismo.
  const [udnCargada, setUdnCargada] = useState<string | null>(null);

  async function cargar(udn: string) {
    if (!udn || cargando || udn === udnCargada) return;
    setCargando(true);
    try {
      setRutas(await api.listRutas(udn));
      setUdnCargada(udn);
    } catch {
      // Sin red no hay lista: el selector muestra su mensaje de vacío y se puede reintentar.
      setRutas([]);
    } finally {
      setCargando(false);
    }
  }

  return { rutas, cargando, cargar };
}
