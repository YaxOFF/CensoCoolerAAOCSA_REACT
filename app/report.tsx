/* ReportScreen — §10: solo exportación del reporte corporativo (Excel/PDF).
   El universo incluye los pendientes de FROG (Censado = NO), no solo lo censado.
   El detalle y las distribuciones viven en el archivo exportado, no en la pantalla. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { api } from '@/api';
import type { Reporte } from '@/api/types';
import { exportarCsv, exportarPdf } from '@/lib/export';
import { useSession } from '@/store/session';
import { colors } from '@/theme';
import { Card, Empty, GhostButton, Loading, Muted, Screen } from '@/ui';

export default function ReportScreen() {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'csv' | 'pdf' | null>(null);
  const { ruta, usuario } = useSession();

  useFocusEffect(
    useCallback(() => {
      api
        .getReporte()
        .then(setReporte)
        .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo generar el reporte.'));
    }, [])
  );

  async function exportar(formato: 'csv' | 'pdf') {
    if (!reporte) return;
    setExportando(formato);
    try {
      if (formato === 'csv') await exportarCsv(reporte.filas);
      else await exportarPdf(reporte, usuario);
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setExportando(null);
    }
  }

  if (error) return <Empty>{error}</Empty>;
  if (!reporte) return <Loading text="Generando reporte…" />;

  return (
    <Screen>
      <Card style={{ marginBottom: 12 }}>
        <Muted>Ruta</Muted>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.blue }}>{ruta ?? '—'}</Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <GhostButton
          onPress={() => exportar('csv')}
          disabled={exportando !== null}
          icon={exportando === 'csv' ? undefined : 'download-outline'}
          style={{ flex: 1 }}
        >
          {exportando === 'csv' ? 'Exportando…' : 'Excel (CSV)'}
        </GhostButton>
        <GhostButton
          onPress={() => exportar('pdf')}
          disabled={exportando !== null}
          icon={exportando === 'pdf' ? undefined : 'print-outline'}
          style={{ flex: 1 }}
        >
          {exportando === 'pdf' ? 'Exportando…' : 'PDF'}
        </GhostButton>
      </View>
    </Screen>
  );
}
