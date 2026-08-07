/* HomeScreen — home.html de la demo: KPIs de avance y accesos rápidos. */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { USE_MOCK } from '@/api';
import {
  leerEstadoOffline,
  precargarPadron,
  suscribirOffline,
  type ResultadoPrecarga,
} from '@/api/offline';
import { fmtFecha } from '@/lib/format';
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
  const { ruta, udn, salir } = useSession();
  const { resumen, error, recargar } = useResumen();
  const router = useRouter();
  const [refrescando, setRefrescando] = useState(false);
  const off = useSyncExternalStore(suscribirOffline, leerEstadoOffline, leerEstadoOffline);
  const [precarga, setPrecarga] = useState<ResultadoPrecarga | null>(null);
  const [descargando, setDescargando] = useState(false);
  // Ref y no estado: el guard tiene que verse desde el callback del foco, que no
  // se vuelve a crear en cada render.
  const enCurso = useRef(false);

  /* Requisito del usuario: el padrón de la ruta se descarga SOLO al entrar aquí.
     Así el inspector sabe exactamente dónde se refrescan sus datos sin conexión,
     y ninguna otra pantalla se pone a bajar decenas de filas por su cuenta. */
  const descargarPadron = useCallback(async () => {
    if (USE_MOCK || !ruta || enCurso.current) return;
    enCurso.current = true;
    setDescargando(true);
    try {
      setPrecarga(await precargarPadron(ruta, udn ?? ''));
    } finally {
      enCurso.current = false;
      setDescargando(false);
    }
  }, [ruta, udn]);

  useFocusEffect(
    useCallback(() => {
      descargarPadron();
    }, [descargarPadron])
  );

  // recargar() no expone su propio estado de carga: el spinner del gesto lo lleva la pantalla.
  async function refrescar() {
    setRefrescando(true);
    try {
      await Promise.all([recargar(), descargarPadron()]);
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

      {/* Estado de los datos sin conexión. El inspector tiene que poder ver, antes
          de salir a ruta, si lleva el padrón encima y de cuándo es. */}
      {!USE_MOCK && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginLeft: 4 }}>
          <Ionicons
            name={off.hayPadron ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={16}
            color={off.hayPadron ? colors.green : colors.red}
          />
          <Muted style={{ flex: 1, color: off.hayPadron ? colors.text2 : colors.red }}>
            {descargando
              ? 'Descargando datos para trabajar sin conexión…'
              : off.hayPadron
                ? `Sin conexión: ${off.padronTotal} equipo(s) listos · ${fmtFecha(off.padronFecha ?? '')}`
                : (precarga?.error ?? 'Todavía no se han descargado los datos para trabajar sin conexión.')}
          </Muted>
          {!descargando && (!off.hayPadron || precarga?.ok === false) && (
            <MiniButton onPress={descargarPadron}>Reintentar</MiniButton>
          )}
        </View>
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
