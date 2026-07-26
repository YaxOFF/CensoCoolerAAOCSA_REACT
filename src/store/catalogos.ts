/* Catálogos (tipos, estados, CEDIS, rutas). Se piden a la API como todo lo demás,
   así el día que vengan de un endpoint no cambia ninguna pantalla. */

import { useEffect, useState } from 'react';

import { api } from '../api';
import type { Catalogos } from '../api/types';

const VACIO: Catalogos = { tipos: [], estadosEnfriador: [], cedis: [], rutas: [], marcas: [] };

export function useCatalogos(): Catalogos {
  const [catalogos, setCatalogos] = useState<Catalogos>(VACIO);

  useEffect(() => {
    let vivo = true;
    api
      .getCatalogos()
      .then((c) => vivo && setCatalogos(c))
      .catch(() => {}); // sin catálogos la UI queda con listas vacías, no revienta
    return () => {
      vivo = false;
    };
  }, []);

  return catalogos;
}
