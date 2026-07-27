/* Aviso de red. Se alimenta del estado que deriva src/api/client.ts del propio
   tráfico HTTP: si el backend contesta hay red, si no contesta no la hay.
   Se monta una sola vez en el layout raíz. */

import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leerEstadoRed, suscribirRed } from '@/api/client';
import { colors } from '@/theme';

const MENSAJES = {
  'sin-conexion': { texto: 'Sin conexión. Revisa tu internet.', color: colors.red },
  inestable: { texto: 'Red inestable: el servidor está tardando.', color: colors.amber },
} as const;

export function BannerRed() {
  const estado = useSyncExternalStore(suscribirRed, leerEstadoRed, leerEstadoRed);
  const insets = useSafeAreaInsets();

  if (estado === 'ok') return null;
  const { texto, color } = MENSAJES[estado];

  return (
    <View style={[styles.banner, { backgroundColor: color, paddingTop: insets.top + 6 }]}>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 6, paddingHorizontal: 16 },
  texto: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
