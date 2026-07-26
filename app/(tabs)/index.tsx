/* HomeScreen — home.html de la demo: KPIs de avance y accesos rápidos. */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { USE_MOCK } from '@/api';
import { useResumen } from '@/store/resumen';
import { useSession } from '@/store/session';
import { colors } from '@/theme';
import {
  Hero,
  Hint,
  Loading,
  MiniButton,
  Muted,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StatRow,
  Tag,
} from '@/ui';

export default function HomeScreen() {
  const { ruta, salir } = useSession();
  const { resumen, error } = useResumen();
  const router = useRouter();

  return (
    <Screen>
      <Hero
        kicker="Censo Nacional"
        title="Enfriadores"
        sub="Captura, valida y registra el parque de enfriadores en campo."
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginLeft: 4 }}>
        <Tag text={`Ruta ${ruta ?? '—'}`} color={colors.blue} />
        <MiniButton onPress={salir}>Cambiar ruta</MiniButton>
      </View>

      {error && <Muted style={{ color: colors.red, marginBottom: 12 }}>{error}</Muted>}

      {resumen ? (
        <StatRow
          items={[
            { valor: resumen.totalFrog, etiqueta: 'En FROG', color: colors.blue },
            { valor: resumen.censados, etiqueta: 'Censados', color: colors.green },
            { valor: `${resumen.porcentaje}%`, etiqueta: 'Avance', color: colors.amber },
          ]}
        />
      ) : (
        !error && <Loading text="Cargando indicadores…" />
      )}

      <View style={{ gap: 12, marginTop: 20 }}>
        {/* navigate y no push: son tabs, no queremos apilar la misma pantalla. */}
        <PrimaryButton onPress={() => router.navigate('/search')}>◎  Escanear / Capturar serie</PrimaryButton>
        <SecondaryButton onPress={() => router.navigate('/dashboard')}>📊  Dashboard</SecondaryButton>
        <SecondaryButton onPress={() => router.navigate('/history')}>🗂  Historial</SecondaryButton>
      </View>

      {USE_MOCK && (
        <Hint>Series de prueba: IMB-100238 · MTF-559012 · OJE-778341. Cualquier otra = NUEVO.</Hint>
      )}
    </Screen>
  );
}
