/* DashboardScreen — dashboard.html de la demo. §9: avance y distribuciones. */

import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useResumen } from '@/store/resumen';
import { colors } from '@/theme';
import {
  Card,
  DistBars,
  Empty,
  Loading,
  PrimaryButton,
  ProgressBar,
  Screen,
  Section,
  StatRow,
} from '@/ui';

export default function DashboardScreen() {
  const { resumen, error } = useResumen();
  const router = useRouter();

  if (error) return <Empty>{error}</Empty>;
  if (!resumen) return <Loading text="Calculando avance…" />;

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>Avance general</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.blue }}>
            {resumen.porcentaje}%
          </Text>
        </View>
        <ProgressBar pct={resumen.porcentaje} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.text2 }}>FROG: {resumen.totalFrog}</Text>
          <Text style={{ fontSize: 12, color: colors.text2 }}>Censados: {resumen.censados}</Text>
          <Text style={{ fontSize: 12, color: colors.text2 }}>Pendiente: {resumen.pendientes}</Text>
        </View>
      </Card>

      <Section>Estatus del registro</Section>
      <StatRow
        items={[
          { valor: resumen.porStatus.CORRECTO, etiqueta: 'Correctos', color: colors.green },
          { valor: resumen.porStatus['CORRECCIÓN'], etiqueta: 'Correcciones', color: colors.amber },
          { valor: resumen.porStatus.NUEVO, etiqueta: 'Nuevos', color: colors.purple },
        ]}
      />

      <Section>Estado del enfriador</Section>
      <DistBars data={resumen.porEstado} total={resumen.censados} color={colors.blue} />

      <Section>Avance por CEDIS</Section>
      <DistBars data={resumen.porCedis} total={resumen.censados} color={colors.green} />

      <PrimaryButton onPress={() => router.push('/report')} style={{ marginTop: 24 }}>
        📄  Reporte corporativo
      </PrimaryButton>
    </Screen>
  );
}
