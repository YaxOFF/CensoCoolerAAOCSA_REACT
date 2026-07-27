/* ReportScreen — §10: el reporte lo genera el BACKEND (cruce FROG vs. censado) y
   devuelve una URL de descarga, no el archivo. Desde aquí solo se abre, se comparte
   o se pasa por QR. El rango del reporte es la ruta del inspector. */

import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { api } from '@/api';
import type { ReporteArchivo } from '@/api/types';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { Card, GhostButton, Hero, KeyValues, Muted, PrimaryButton, Screen } from '@/ui';

type Formato = 'excel' | 'pdf';

const EXT: Record<Formato, string> = { excel: 'xlsx', pdf: 'pdf' };
const MIME: Record<Formato, string> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export default function ReportScreen() {
  const [generando, setGenerando] = useState<Formato | null>(null);
  const [archivo, setArchivo] = useState<(ReporteArchivo & { formato: Formato }) | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [qr, setQr] = useState(false);
  const { ruta } = useSession();

  async function generar(formato: Formato) {
    if (!ruta) return;
    setGenerando(formato);
    try {
      setArchivo({ ...(await api.generarReporte(formato, ruta)), formato });
    } catch (e) {
      // 409 = no hay ronda de censo, 502 = FROG falló: el mensaje del backend lo explica.
      Alert.alert('No se pudo generar', e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setGenerando(null);
    }
  }

  async function abrir() {
    if (!archivo) return;
    try {
      await Linking.openURL(archivo.url);
    } catch {
      Alert.alert('No se pudo abrir', 'No hay una app que pueda abrir este archivo.');
    }
  }

  /* Baja el archivo a la caché y abre la hoja de compartir con el archivo real
     (no el enlace): desde ahí el sistema permite guardarlo o mandarlo por WhatsApp. */
  async function descargar() {
    if (!archivo) return;
    setDescargando(true);
    try {
      const destino = `${cacheDirectory}censo_folio${archivo.folio}.${EXT[archivo.formato]}`;
      const { uri, status } = await downloadAsync(archivo.url, destino);
      if (status !== 200) throw new Error(`El servidor respondió ${status}.`);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Descargado', uri);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: MIME[archivo.formato],
        dialogTitle: 'Reporte del censo',
      });
    } catch (e) {
      Alert.alert('No se pudo descargar', e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Screen>
      <Hero kicker="Censo AAOCSA" title="Reporte" />

      <Card style={{ marginBottom: 12 }}>
        <Muted>Ruta</Muted>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.blue }}>{ruta ?? '—'}</Text>
      </Card>

      {/* Sólidos y con el color de cada formato: Excel verde, PDF rojo. */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PrimaryButton
          onPress={() => generar('excel')}
          disabled={generando !== null || !ruta}
          loading={generando === 'excel'}
          icon="grid-outline"
          style={{ flex: 1, backgroundColor: colors.green }}
        >
          Excel
        </PrimaryButton>
        <PrimaryButton
          onPress={() => generar('pdf')}
          disabled={generando !== null || !ruta}
          loading={generando === 'pdf'}
          icon="document-text-outline"
          style={{ flex: 1, backgroundColor: colors.red }}
        >
          PDF
        </PrimaryButton>
      </View>

      {archivo && (
        <Card style={{ marginTop: 12 }}>
          <Muted>{archivo.formato === 'excel' ? 'Excel listo' : 'PDF listo'}</Muted>
          <KeyValues
            rows={[
              ['Folio', String(archivo.folio)],
              ['Total', String(archivo.total)],
              ['Censados', String(archivo.censados)],
              ['No censados', String(archivo.noCensados)],
            ]}
          />
          <Muted>El enlace deja de servir a los 14 días: descárgalo si lo quieres conservar.</Muted>

          <View style={{ marginTop: 12, gap: 10 }}>
            <PrimaryButton onPress={abrir} icon="open-outline" disabled={descargando}>
              Abrir
            </PrimaryButton>
            <PrimaryButton
              onPress={descargar}
              loading={descargando}
              icon="download-outline"
              style={{ backgroundColor: colors.text2 }}
            >
              Descargar archivo
            </PrimaryButton>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GhostButton
                onPress={() => Share.share({ message: archivo.url })}
                icon="share-social-outline"
                style={{ flex: 1 }}
              >
                Compartir
              </GhostButton>
              <GhostButton onPress={() => setQr(true)} icon="qr-code-outline" style={{ flex: 1 }}>
                QR
              </GhostButton>
            </View>
          </View>
        </Card>
      )}

      <Modal visible={qr} transparent animationType="fade" onRequestClose={() => setQr(false)}>
        <Pressable
          onPress={() => setQr(false)}
          style={{ flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: radius.card, gap: 12 }}>
            {archivo && <QRCode value={archivo.url} size={240} />}
            <Text style={{ textAlign: 'center', color: colors.text2, fontSize: 12 }}>
              Escanea para descargar el reporte
            </Text>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}
