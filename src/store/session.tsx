/* Sesión del inspector. Como en la demo, la RUTA identifica a quien censa: no hay
   contraseña. Cuando exista auth real, aquí se agrega el token (client.setAuthToken). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY_RUTA = 'censo_ruta';
const KEY_UDN = 'censo_udn';

interface SessionValue {
  ruta: string | null;
  /** CEDIS elegido en el login. Acota las consultas por ruta (?udn=…&ruta=…). */
  udn: string | null;
  /** false mientras se lee AsyncStorage: evita parpadear el login al arrancar. */
  cargando: boolean;
  entrar(ruta: string, udn?: string): Promise<void>;
  salir(): Promise<void>;
  /** Nombre que se graba en el registro (§12.3). Con auth real vendría del token. */
  usuario: string;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ruta, setRuta] = useState<string | null>(null);
  const [udn, setUdn] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet([KEY_RUTA, KEY_UDN])
      .then(([[, r], [, u]]) => {
        setRuta(r);
        setUdn(u);
      })
      .finally(() => setCargando(false));
  }, []);

  const value: SessionValue = {
    ruta,
    udn,
    cargando,
    usuario: ruta ? `inspector.${ruta.toLowerCase()}` : 'inspector.demo',
    async entrar(nueva, nuevaUdn) {
      const limpia = nueva.trim().toUpperCase();
      const udnLimpia = nuevaUdn?.trim() ?? '';
      await AsyncStorage.multiSet([
        [KEY_RUTA, limpia],
        [KEY_UDN, udnLimpia],
      ]);
      setRuta(limpia);
      setUdn(udnLimpia || null);
    },
    async salir() {
      await AsyncStorage.multiRemove([KEY_RUTA, KEY_UDN]);
      setRuta(null);
      setUdn(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
