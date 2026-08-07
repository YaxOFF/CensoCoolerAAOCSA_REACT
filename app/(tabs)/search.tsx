/* SearchScreen — search.html de la demo.
   §3: la búsqueda es por escaneo del código de barras o captura manual de la serie.
   El escáner es real (expo-camera); si no hay permiso o cámara, queda el escaneo simulado. */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { api, USE_MOCK } from '@/api';
import { SERIES_DEMO } from '@/api/mock';
import { leerEstadoOffline } from '@/api/offline';
import type { Enfriador } from '@/api/types';
import { esDeOtraRuta } from '@/lib/rules';
import { useDraft } from '@/store/draft';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { Card, Chip, Field, GhostButton, Hero, Input, Muted, PrimaryButton, Screen } from '@/ui';

export default function SearchScreen() {
  const [serie, setSerie] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { iniciar } = useDraft();
  const { ruta } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ serie?: string; n?: string }>();

  // Acceso directo desde el Historial (/search?serie=…): solo precarga el campo, igual
  // que el escaneo. Consultar en FROG sigue siendo un toque explícito del inspector.
  useEffect(() => {
    if (params.serie) setSerie(params.serie.toUpperCase());
  }, [params.serie, params.n]);

  async function abrirEscaner() {
    if (!permiso?.granted) {
      const res = await pedirPermiso();
      if (!res.granted) {
        Alert.alert(
          'Cámara no disponible',
          'Sin permiso de cámara puedes capturar la serie a mano o usar el escaneo simulado.'
        );
        return;
      }
    }
    setEscaneando(true);
  }

  function onEscaneo(valor: string) {
    setEscaneando(false);
    setSerie(valor.trim().toUpperCase());
  }

  function abrirCenso(serieLimpia: string, enfriador: Enfriador) {
    iniciar(serieLimpia, enfriador);
    router.push('/censo/result');
  }

  async function consultar() {
    const limpia = serie.trim().toUpperCase();
    if (!limpia) {
      Alert.alert('Falta la serie', 'Captura o escanea un número de serie.');
      return;
    }
    setBuscando(true);
    try {
      // §4: solo se censa lo que existe en FROG. Sin coincidencia se avisa y no se inicia
      // el censo: casi siempre es un error de captura, no un equipo que falte en la base.
      const enfriador = await api.lookupEnfriador(limpia);
      if (!enfriador) {
        // Sin conexión la búsqueda va contra el padrón descargado, que solo tiene la
        // ruta del inspector: el mensaje tiene que decirlo o parece que FROG falló.
        Alert.alert(
          'Serie no encontrada',
          leerEstadoOffline().modo
            ? `La serie ${limpia} no está en el padrón de tu ruta que se descargó en Inicio. Sin conexión solo se pueden censar esos equipos: verifica la serie o conéctate a internet para consultar FROG.`
            : `La serie ${limpia} no existe en FROG. Verifica que la capturaste completa y sin errores, y vuelve a intentar.`
        );
        return;
      }
      // El backend filtra el avance, el historial y el reporte por ?ruta=. Censar un
      // equipo de otra ruta es válido y a veces necesario, pero el registro no le
      // vuelve al inspector: sin este aviso se lee como una captura perdida.
      if (esDeOtraRuta(enfriador.ruta, ruta)) {
        Alert.alert(
          'Este enfriador es de otra ruta',
          `La serie ${limpia} está asignada a la ruta ${enfriador.ruta}, y tú entraste con la ruta ${ruta}.\n\n` +
            `Puedes censarlo y se guardará bien, pero quedará registrado en la ruta ${enfriador.ruta}: ` +
            'no lo verás en tu avance, tu historial ni tu reporte.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Censar de todos modos', onPress: () => abrirCenso(limpia, enfriador) },
          ]
        );
        return;
      }
      abrirCenso(limpia, enfriador);
    } catch (e) {
      Alert.alert('Error de consulta', e instanceof Error ? e.message : 'No se pudo consultar FROG.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Screen top>
      <Hero kicker="Censar" title="Buscar enfriador" />

      <Card>
        <Muted style={{ marginBottom: 16 }}>
          Escanea el código de barras o captura el número de serie.
        </Muted>

        <View style={s.scanner}>
          {escaneando ? (
            <View style={s.frame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'qr'],
                }}
                onBarcodeScanned={({ data }) => onEscaneo(data)}
              />
              <Pressable style={s.cerrar} onPress={() => setEscaneando(false)}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={[s.frame, s.frameApagado]}>
              <Ionicons name="scan-outline" size={38} color={colors.blue} />
              <Text style={s.frameText}>Escáner listo</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <GhostButton onPress={abrirEscaner} icon="camera-outline" style={{ flex: 1 }}>
              Escanear
            </GhostButton>
            {USE_MOCK && (
              <GhostButton
                onPress={() => setSerie(SERIES_DEMO[Math.floor(Math.random() * SERIES_DEMO.length)])}
                style={{ flex: 1 }}
              >
                Simular escaneo
              </GhostButton>
            )}
          </View>
        </View>

        <Field label="Número de serie">
          <Input
            value={serie}
            onChangeText={setSerie}
            placeholder="Ej. IMB-100238"
            onSubmitEditing={consultar}
          />
        </Field>

        <PrimaryButton onPress={consultar} loading={buscando}>
          Consultar en FROG
        </PrimaryButton>

        {USE_MOCK && (
          <>
            <Muted style={{ marginTop: 16, fontSize: 12 }}>Toca para probar:</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {SERIES_DEMO.map((x) => (
                <Chip key={x} label={x} onPress={() => setSerie(x)} />
              ))}
              <Chip label="ZZZ-000000 (no existe)" onPress={() => setSerie('ZZZ-000000')} />
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  scanner: { marginBottom: 16 },
  frame: {
    height: 190,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameApagado: { gap: 6 },
  frameText: { color: '#8e8e93', fontSize: 12 },
  cerrar: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
