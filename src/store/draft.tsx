/* El censo en construcción mientras el usuario recorre search → result → form → done.
   Equivale al `sessionStorage` de la demo. Vive solo en memoria: si la app se cierra a
   media captura, el censo se descarta (igual que la demo). */

import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Draft, Enfriador, RegistroCenso } from '../api/types';

interface DraftValue {
  draft: Draft | null;
  /** Arranca un censo desde lo que respondió FROG, o vacío si la serie no existe. */
  iniciar(numeroSerie: string, enfriador: Enfriador | null): Draft;
  actualizar(patch: Partial<Draft>): void;
  limpiar(): void;
  /** Último censo guardado, para la pantalla de confirmación. */
  ultimo: RegistroCenso | null;
  setUltimo(rec: RegistroCenso): void;
}

const Ctx = createContext<DraftValue | null>(null);

function draftVacio(numeroSerie: string, enfriador: Enfriador | null): Draft {
  const base: Enfriador = enfriador ?? {
    numeroSerie,
    numeroCliente: '',
    nombreCliente: '',
    direccion: '',
    cedis: '',
    ruta: '',
    marca: '',
    modelo: '',
    tipo: '',
  };
  return {
    ...base,
    numeroSerie,
    // §5: sin coincidencia en FROG el status ya queda decidido como NUEVO.
    status: enfriador ? null : 'NUEVO',
    esNuevo: !enfriador,
    estadoEnfriador: '',
    observaciones: '',
    fotos: [],
    gps: null,
  };
}

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ultimo, setUltimo] = useState<RegistroCenso | null>(null);

  const value: DraftValue = {
    draft,
    ultimo,
    setUltimo,
    iniciar(numeroSerie, enfriador) {
      const nuevo = draftVacio(numeroSerie.trim().toUpperCase(), enfriador);
      setDraft(nuevo);
      return nuevo;
    },
    actualizar(patch) {
      setDraft((d) => (d ? { ...d, ...patch } : d));
    },
    limpiar() {
      setDraft(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDraft(): DraftValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDraft debe usarse dentro de <DraftProvider>');
  return ctx;
}
