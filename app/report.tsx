/* ReportScreen — report.html de la demo. §10: reporte corporativo + export Excel/PDF.
   El universo incluye los pendientes de FROG (Censado = NO), no solo lo censado. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import type { Reporte, ReporteRow } from '@/api/types';
import { exportarCsv, exportarPdf } from '@/lib/export';
import { fmtFecha } from '@/lib/format';
import { COLUMNAS_REPORTE } from '@/lib/rules';
import { useSession } from '@/store/session';
import { colors, radius, shadow, statusColor, tint } from '@/theme';
import {
  Card,
  DistBars,
  Empty,
  GhostButton,
  Loading,
  Muted,
  Screen,
  Section,
  StatRow,
} from '@/ui';

/** Ancho fijo por columna: la tabla se desplaza en horizontal, como en la demo. */
const ANCHOS: Partial<Record<(typeof COLUMNAS_REPORTE)[number]['campo'], number>> = {
  nombreCliente: 160,
  direccion: 200,
  observaciones: 200,
  estadoEnfriador: 130,
  fecha: 120,
};
const ANCHO_BASE = 100;

export default function ReportScreen() {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'csv' | 'pdf' | null>(null);
  const { usuario } = useSession();

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

  const { resumen, filas } = reporte;

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>
        Generado {fmtFecha(new Date().toISOString())} · {filas.length} equipos · Usuario {usuario}
      </Muted>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
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

      <Section>Indicadores</Section>
      <StatRow
        items={[
          { valor: resumen.censados, etiqueta: 'Censados', color: colors.green },
          { valor: resumen.pendientes, etiqueta: 'Pendientes', color: colors.amber },
          { valor: resumen.porStatus.NUEVO, etiqueta: 'Nuevos', color: colors.purple },
        ]}
      />
      <View style={{ height: 10 }} />
      <StatRow
        items={[
          { valor: resumen.porStatus.CORRECTO, etiqueta: 'Correctos', color: colors.blue },
          { valor: resumen.porStatus['CORRECCIÓN'], etiqueta: 'Correcciones', color: colors.amber },
          { valor: resumen.totalFrog, etiqueta: 'Total FROG' },
        ]}
      />

      <Section>Distribución por estado del enfriador</Section>
      <DistBars data={resumen.porEstado} total={resumen.censados} color={colors.blue} />

      <Section>Distribución por CEDIS</Section>
      <DistBars data={resumen.porCedis} total={resumen.censados} color={colors.green} />

      <Section>Distribución por tipo</Section>
      <DistBars data={resumen.porTipo} total={resumen.censados} color={colors.purple} />

      <Section>Distribución por marca / modelo</Section>
      <DistBars data={resumen.porMarcaModelo} total={resumen.censados} color={colors.amber} />

      <Section>Detalle del censo</Section>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[s.fila, s.encabezado]}>
              {COLUMNAS_REPORTE.map((c) => (
                <Text key={c.campo} style={[s.celda, s.th, { width: ANCHOS[c.campo] ?? ANCHO_BASE }]}>
                  {c.titulo}
                </Text>
              ))}
            </View>
            {filas.map((f, i) => (
              <FilaReporte key={`${f.numeroSerie}-${i}`} fila={f} />
            ))}
          </View>
        </ScrollView>
      </Card>
    </Screen>
  );
}

function FilaReporte({ fila }: { fila: ReporteRow }) {
  const pendiente = fila.censado === 'NO';
  return (
    <View style={[s.fila, pendiente && { opacity: 0.72 }]}>
      {COLUMNAS_REPORTE.map((c) => {
        const ancho = ANCHOS[c.campo] ?? ANCHO_BASE;

        if (c.campo === 'status') {
          const color = fila.status ? statusColor(fila.status) : colors.text2;
          return (
            <View key={c.campo} style={[s.celda, { width: ancho }]}>
              <View style={[s.pill, { backgroundColor: tint(color) }]}>
                <Text style={[s.pillText, { color }]}>{fila.status || 'PENDIENTE'}</Text>
              </View>
            </View>
          );
        }

        const valor = c.campo === 'fecha' ? (fila.fecha ? fmtFecha(fila.fecha) : '—') : fila[c.campo];
        return (
          <Text
            key={c.campo}
            numberOfLines={1}
            style={[
              s.celda,
              { width: ancho },
              c.campo === 'censado' && {
                fontWeight: '700',
                color: fila.censado === 'SI' ? colors.green : colors.text2,
              },
            ]}
          >
            {valor || '—'}
          </Text>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  encabezado: { backgroundColor: colors.card2 },
  celda: { paddingVertical: 9, paddingHorizontal: 12, fontSize: 12, color: colors.text },
  th: { color: colors.text2, fontWeight: '700' },
  pill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '700' },
});
