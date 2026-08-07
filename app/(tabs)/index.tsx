/* HomeScreen — home.html de la demo: KPIs de avance y accesos rápidos. */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
  const { resumen, error, recargar } = useResumen();
  const router = useRouter();
  const [refrescando, setRefrescando] = useState(false);

  // recargar() no expone su propio estado de carga: el spinner del gesto lo lleva la pantalla.
  async function refrescar() {
    setRefrescando(true);
    try {
      await recargar();
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <Screen top refreshing={refrescando} onRefresh={refrescar}>
      <Hero
        kicker="Censo AAOCSA"
        title="Enfriadores"
        sub="Captura, valida y registra el parque de enfriadores en campo."
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginLeft: 4 }}>
        <Tag text={`Ruta ${ruta ?? '—'}`} color={colors.blue} />
        {resumen?.folio != null && <Tag text={`Folio ${resumen.folio}`} color={colors.amber} />}
        <MiniButton onPress={salir}>Cambiar ruta</MiniButton>
      </View>

      {error && <Muted style={{ color: colors.red, marginBottom: 12 }}>{error}</Muted>}

      {resumen ? (
        <StatRow
          items={[
            // Cada cifra abre el Historial en el modo que la representa.
            {
              valor: resumen.totalFrog,
              etiqueta: 'En FROG',
              color: colors.blue,
              onPress: () => router.navigate('/history?modo=frog'),
            },
            {
              valor: resumen.censados,
              etiqueta: 'Censados',
              color: colors.green,
              onPress: () => router.navigate('/history?modo=censados'),
            },
            {
              valor: resumen.pendientes,
              etiqueta: 'Faltantes',
              color: colors.red,
              onPress: () => router.navigate('/history?modo=faltantes'),
            },
            { valor: `${resumen.porcentaje}%`, etiqueta: 'Avance', color: colors.amber },
          ]}
        />
      ) : (
        !error && <Loading text="Cargando indicadores…" />
      )}

      <View style={{ gap: 12, marginTop: 20 }}>
        {/* navigate y no push: son tabs, no queremos apilar la misma pantalla. */}
        <PrimaryButton onPress={() => router.navigate('/search')} icon="scan-outline">
          Escanear / Capturar serie
        </PrimaryButton>
        <SecondaryButton onPress={() => router.navigate('/dashboard')} icon="stats-chart-outline">
          Dashboard
        </SecondaryButton>
        <SecondaryButton onPress={() => router.navigate('/history')} icon="albums-outline">
          Historial
        </SecondaryButton>
      </View>

      {USE_MOCK && (
        <Hint>
          Series de prueba: IMB-100238 · MTF-559012 · OJE-778341. Cualquier otra no existe en FROG.
        </Hint>
      )}
    </Screen>
  );
}
