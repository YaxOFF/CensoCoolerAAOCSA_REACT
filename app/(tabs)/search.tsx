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
import { useDraft } from '@/store/draft';
import { colors, radius } from '@/theme';
import { Card, Chip, Field, GhostButton, Hero, Input, Muted, PrimaryButton, Screen } from '@/ui';

export default function SearchScreen() {
  const [serie, setSerie] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { iniciar } = useDraft();
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

  async function consultar() {
    const limpia = serie.trim().toUpperCase();
    if (!limpia) {
      Alert.alert('Falta la serie', 'Captura o escanea un número de serie.');
      return;
    }
    setBuscando(true);
    try {
      // §4: si FROG responde, se recuperan los datos; si no, el censo nace como NUEVO.
      const enfriador = await api.lookupEnfriador(limpia);
      iniciar(limpia, enfriador);
      router.push('/censo/result');
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
              <Chip label="ZZZ-000000 (nuevo)" onPress={() => setSerie('ZZZ-000000')} />
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
