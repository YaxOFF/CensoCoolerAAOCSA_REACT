/* Sesión del inspector. Como en la demo, la RUTA identifica a quien censa: no hay
   contraseña. Cuando exista auth real, aquí se agrega el token (client.setAuthToken). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY_RUTA = 'censo_ruta';

interface SessionValue {
  ruta: string | null;
  /** false mientras se lee AsyncStorage: evita parpadear el login al arrancar. */
  cargando: boolean;
  entrar(ruta: string): Promise<void>;
  salir(): Promise<void>;
  /** Nombre que se graba en el registro (§12.3). Con auth real vendría del token. */
  usuario: string;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ruta, setRuta] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY_RUTA)
      .then(setRuta)
      .finally(() => setCargando(false));
  }, []);

  const value: SessionValue = {
    ruta,
    cargando,
    usuario: ruta ? `inspector.${ruta.toLowerCase()}` : 'inspector.demo',
    async entrar(nueva) {
      const limpia = nueva.trim().toUpperCase();
      await AsyncStorage.setItem(KEY_RUTA, limpia);
      setRuta(limpia);
    },
    async salir() {
      await AsyncStorage.removeItem(KEY_RUTA);
      setRuta(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
