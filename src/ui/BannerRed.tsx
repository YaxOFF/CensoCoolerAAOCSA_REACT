/* Aviso permanente del estado de la conexión y de la cola offline. Se monta una
   sola vez en el layout raíz.

   Dos fuentes: el estado de red que deriva src/api/client.ts del propio tráfico
   HTTP, y el del modo Sin Internet de src/api/offline.ts. El inspector tiene que
   poder saber de un vistazo, en cualquier pantalla, si está capturando contra la
   copia local y cuántos censos le faltan por mandar. */

import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leerEstadoRed, suscribirRed } from '@/api/client';
import { leerEstadoOffline, suscribirOffline } from '@/api/offline';
import { colors } from '@/theme';

const plural = (n: number) => (n === 1 ? 'censo' : 'censos');

export function BannerRed() {
  const red = useSyncExternalStore(suscribirRed, leerEstadoRed, leerEstadoRed);
  const off = useSyncExternalStore(suscribirOffline, leerEstadoOffline, leerEstadoOffline);
  const insets = useSafeAreaInsets();

  const aviso = mensaje(red, off.modo, off.pendientes);
  if (!aviso) return null;

  return (
    <View style={[styles.banner, { backgroundColor: aviso.color, paddingTop: insets.top + 6 }]}>
      <Text style={styles.texto}>{aviso.texto}</Text>
    </View>
  );
}

/* Prioridad: primero lo que le impide trabajar en línea, luego lo que le falta
   por mandar. El modo activo gana sobre "sin conexión" porque dice lo mismo y
   además cuánto lleva pendiente. */
function mensaje(
  red: ReturnType<typeof leerEstadoRed>,
  modo: boolean,
  pendientes: number
): { texto: string; color: string } | null {
  if (modo)
    return {
      texto: pendientes
        ? `Modo Sin Internet · ${pendientes} ${plural(pendientes)} por enviar`
        : 'Modo Sin Internet: estás capturando con los datos descargados.',
      color: colors.purple,
    };
  if (red === 'sin-conexion')
    return { texto: 'Sin conexión. Revisa tu internet.', color: colors.red };
  if (pendientes)
    return {
      texto: `${pendientes} ${plural(pendientes)} sin enviar. Mándalos desde el Historial.`,
      color: colors.amber,
    };
  if (red === 'inestable')
    return { texto: 'Red inestable: el servidor está tardando.', color: colors.amber };
  return null;
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 6, paddingHorizontal: 16 },
  texto: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
