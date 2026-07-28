/* Aviso de nueva versión del APK. Se monta una sola vez en el layout raíz, igual
   que <BannerRed>. La lógica de red e instalación vive en src/api/updates.ts.

   Con forceUpdate el modal no se puede cerrar: sin botón de "después", sin
   onRequestClose y sin cierre por back de Android. Es el único caso en que la
   app queda bloqueada a propósito. */

import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  abrirAjustesInstalacion,
  buscarActualizacion,
  descargarEInstalar,
  UpdateError,
  versionNombreInstalada,
  type VersionRemota,
} from '@/api/updates';
import { colors, radius, spacing } from '@/theme';
import { GhostButton, H2, Muted, PrimaryButton, ProgressBar, SecondaryButton } from '@/ui';

type Fase = 'aviso' | 'descargando' | 'error';

export function ModalActualizacion() {
  const [version, setVersion] = useState<VersionRemota | null>(null);
  const [fase, setFase] = useState<Fase>('aviso');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<UpdateError | null>(null);

  useEffect(() => {
    // Silencioso a propósito: si el servidor de updates está caído el inspector
    // tiene que poder censar igual. El error solo se muestra si él pidió actualizar.
    buscarActualizacion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  const actualizar = useCallback(async () => {
    if (!version) return;
    setFase('descargando');
    setPct(0);
    setError(null);
    try {
      await descargarEInstalar(version, (p) => setPct(p < 0 ? -1 : Math.round(p * 100)));
      // El instalador ya está al frente; volvemos al aviso por si el usuario cancela.
      setFase('aviso');
    } catch (e) {
      setError(e instanceof UpdateError ? e : new UpdateError('Error inesperado.', 'descarga'));
      setFase('error');
    }
  }, [version]);

  if (!version) return null;
  const forzada = version.forceUpdate === true;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Sin esto, el botón atrás de Android cierra el modal y se salta la actualización forzada.
      onRequestClose={forzada ? () => {} : () => setVersion(null)}
    >
      <View style={styles.fondo}>
        <View style={styles.caja}>
          <H2>Nueva versión disponible</H2>
          <Muted>{`Tienes la versión ${versionNombreInstalada()}; la ${version.versionName} ya está lista.`}</Muted>

          {!!version.whatsNew && (
            <ScrollView style={styles.changelog}>
              <Text style={styles.changelogTexto}>{version.whatsNew}</Text>
            </ScrollView>
          )}

          {fase === 'descargando' && (
            <View style={styles.progreso}>
              <ProgressBar pct={pct < 0 ? 100 : pct} />
              <Muted>{pct < 0 ? 'Descargando…' : `Descargando… ${pct}%`}</Muted>
            </View>
          )}

          {fase === 'error' && !!error && <Text style={styles.error}>{error.message}</Text>}

          {fase !== 'descargando' && (
            <View style={styles.botones}>
              <PrimaryButton onPress={actualizar} icon="download-outline">
                {fase === 'error' ? 'Reintentar' : 'Actualizar ahora'}
              </PrimaryButton>

              {error?.causa === 'instalacion' && (
                <SecondaryButton onPress={abrirAjustesInstalacion} icon="settings-outline">
                  Abrir ajustes de instalación
                </SecondaryButton>
              )}

              {!forzada && <GhostButton onPress={() => setVersion(null)}>Después</GhostButton>}
            </View>
          )}

          {forzada && (
            <Muted style={styles.aviso}>
              Esta actualización es obligatoria: hay que instalarla para seguir censando.
            </Muted>
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
  changelog: { maxHeight: 180, backgroundColor: colors.card2, borderRadius: radius.input, padding: 12 },
  changelogTexto: { color: colors.text, fontSize: 14, lineHeight: 20 },
  progreso: { gap: 8 },
  error: { color: colors.red, fontSize: 14 },
  botones: { gap: 8 },
  aviso: { textAlign: 'center' },
});
