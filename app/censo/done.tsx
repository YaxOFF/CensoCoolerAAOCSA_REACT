/* DoneScreen — done.html de la demo: confirmación del censo guardado (§8, Censado = SI). */

import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { fmtCoord } from '@/lib/format';
import { useDraft } from '@/store/draft';
import { colors } from '@/theme';
import { Card, H2, KeyValues, Muted, PrimaryButton, Screen, SecondaryButton } from '@/ui';

export default function DoneScreen() {
  const { ultimo } = useDraft();
  const router = useRouter();

  if (!ultimo) return <Redirect href="/" />;

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <View style={s.check}>
          <Text style={s.checkText}>✓</Text>
        </View>
        <H2>Censo guardado</H2>
        <Muted style={{ marginBottom: 8 }}>
          Registro almacenado. <Text style={{ fontWeight: '700' }}>Censado = SI</Text>.
        </Muted>

        <View style={{ alignSelf: 'stretch' }}>
          <KeyValues
            rows={[
              ['N° Serie', ultimo.numeroSerie],
              ['Status', ultimo.status],
              ['Estado', ultimo.estadoEnfriador],
              ['Cliente', ultimo.nombreCliente],
              ['GPS', `${fmtCoord(ultimo.lat, 4)}, ${fmtCoord(ultimo.lng, 4)}`],
              ['Fotos', `${ultimo.fotos.length} de 3`],
              ['Censado', ultimo.censado],
            ]}
          />
        </View>

        <View style={{ alignSelf: 'stretch', gap: 12 }}>
          <PrimaryButton onPress={() => router.replace('/search')}>Censar otro equipo</PrimaryButton>
          <SecondaryButton onPress={() => router.replace('/history')}>Ver historial</SecondaryButton>
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  check: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  checkText: { color: '#fff', fontSize: 40, fontWeight: '700' },
});
