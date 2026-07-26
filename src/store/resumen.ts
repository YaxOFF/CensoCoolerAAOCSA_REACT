/* Indicadores del censo (§9). Se recargan cada vez que la pantalla toma el foco,
   así el avance se actualiza al volver de guardar un censo. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from '../api';
import type { Resumen } from '../api/types';

export function useResumen() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setResumen(await api.getResumen());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los indicadores.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar])
  );

  return { resumen, error, recargar };
}
