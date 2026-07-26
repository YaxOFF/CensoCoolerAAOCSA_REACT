/* HistoryScreen — history.html de la demo: registros censados, más reciente primero. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { USE_MOCK } from '@/api';
import { fmtFecha } from '@/lib/format';
import { useRecords } from '@/store/records';
import { colors, radius, shadow, statusColor } from '@/theme';
import { Empty, Loading, MiniButton, Muted, Tag, ViewHead } from '@/ui';

export default function HistoryScreen() {
  const { registros, cargando, error, refrescar, limpiarDemo } = useRecords();

  useFocusEffect(
    useCallback(() => {
      refrescar();
    }, [refrescar])
  );

  const ordenados = useMemo(
    () => [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [registros]
  );

  function confirmarLimpieza() {
    Alert.alert('Limpiar registros', '¿Borrar los registros locales y recargar los datos de demo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => limpiarDemo() },
    ]);
  }

  if (cargando && !registros.length) return <Loading text="Cargando historial…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={ordenados}
        keyExtractor={(r) => r.numeroSerie}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshing={cargando}
        onRefresh={refrescar}
        ListHeaderComponent={
          USE_MOCK ? (
            <ViewHead>
              <Muted>{registros.length} registro(s)</Muted>
              <MiniButton danger onPress={confirmarLimpieza}>
                Limpiar
              </MiniButton>
            </ViewHead>
          ) : (
            <ViewHead>
              <Muted>{registros.length} registro(s)</Muted>
            </ViewHead>
          )
        }
        ListEmptyComponent={
          <Empty>{error ?? 'Aún no hay registros censados.'}</Empty>
        }
        renderItem={({ item }) => {
          const color = statusColor(item.status);
          return (
            <View style={s.item}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.serie}>{item.numeroSerie}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {item.nombreCliente} · {item.cedis} · {fmtFecha(item.fecha)}
                </Text>
                <Text style={s.sub}>{item.estadoEnfriador}</Text>
              </View>
              <Tag text={item.status} color={color} />
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  item: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    ...shadow,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  serie: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { color: colors.text2, fontSize: 12 },
});
