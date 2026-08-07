/* Aviso de caída de red. Se monta una sola vez en el layout raíz, igual que
   <BannerRed> y <ModalActualizacion>.

   Aparece cuando el sondeo a /health deja de contestar y ofrece pasar al modo Sin
   Internet, que deja seguir censando contra el padrón descargado en Inicio.
   Si no hay padrón no ofrece nada: explica qué pasó y qué hacer, porque activar el
   modo sin datos dejaría al inspector sin poder buscar ninguna serie. */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { leerEstadoRed, suscribirRed } from '@/api/client';
import { activarModoOffline, leerEstadoOffline, suscribirOffline } from '@/api/offline';
import { fmtFecha } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import { GhostButton, H2, Muted, Note, PrimaryButton } from '@/ui';

export function ModalOffline() {
  const red = useSyncExternalStore(suscribirRed, leerEstadoRed, leerEstadoRed);
  const off = useSyncExternalStore(suscribirOffline, leerEstadoOffline, leerEstadoOffline);
  const [descartado, setDescartado] = useState(false);

  // El descarte dura lo que dura la caída: si vuelve la red y se cae otra vez, se
  // pregunta de nuevo. Nadie se queda offline sin saberlo por un "Ahora no" viejo.
  useEffect(() => {
    if (red === 'ok') setDescartado(false);
  }, [red]);

  if (red !== 'sin-conexion' || off.modo || descartado) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDescartado(true)}>
      <View style={styles.fondo}>
        <View style={styles.caja}>
          <H2>Te quedaste sin conexión</H2>

          {off.hayPadron ? (
            <>
              <Muted>
                No hay internet. ¿Quieres cambiar al modo Sin Internet y seguir censando con los
                datos descargados?
              </Muted>
              <Note>
                {`Tienes ${off.padronTotal} equipo(s) de la ruta ${off.padronRuta ?? '—'}, descargados el ${fmtFecha(off.padronFecha ?? '')}. Los censos se guardan en el teléfono y los envías desde el Historial cuando vuelva la señal.`}
              </Note>

              <View style={styles.botones}>
                <PrimaryButton
                  onPress={() => activarModoOffline()}
                  icon="cloud-offline-outline"
                >
                  Sí, cambiar al modo Sin Internet
                </PrimaryButton>
                <GhostButton onPress={() => setDescartado(true)}>Ahora no</GhostButton>
              </View>
            </>
          ) : (
            <>
              <Muted>
                No hay internet y todavía no se han descargado los datos de tu ruta, así que no se
                puede buscar ninguna serie.
              </Muted>
              <Note>
                Conéctate a internet y abre la pantalla de Inicio: ahí se descarga el padrón de la
                ruta. Después podrás censar aunque se caiga la señal.
              </Note>

              <View style={styles.botones}>
                <PrimaryButton onPress={() => setDescartado(true)}>Entendido</PrimaryButton>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.screen,
  },
  caja: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.screen,
    gap: spacing.gap,
  },
  botones: { gap: 8 },
});
