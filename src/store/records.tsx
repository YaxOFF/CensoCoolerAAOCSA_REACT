/* Registros censados. Única fuente de verdad de la UI para Historial y Dashboard.
   Habla solo con `api`: no sabe si detrás hay mock o backend. */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '../api';
import type { RegistroCenso, RegistroCensoInput } from '../api/types';

interface RecordsValue {
  registros: RegistroCenso[];
  cargando: boolean;
  error: string | null;
  refrescar(): Promise<void>;
  guardar(input: RegistroCensoInput): Promise<RegistroCenso>;
  limpiarDemo(): Promise<void>;
}

const Ctx = createContext<RecordsValue | null>(null);

export function RecordsProvider({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<RegistroCenso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setRegistros(await api.listRegistros());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los registros.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const value: RecordsValue = {
    registros,
    cargando,
    error,
    refrescar,
    async guardar(input) {
      const rec = await api.saveRegistro(input);
      await refrescar();
      return rec;
    },
    async limpiarDemo() {
      await api.resetDemo();
      await refrescar();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecords(): RecordsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRecords debe usarse dentro de <RecordsProvider>');
  return ctx;
}
