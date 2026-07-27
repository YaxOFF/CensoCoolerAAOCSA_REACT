/* HistoryScreen — censos levantados desde GET /coolers: paginado, filtrable por
   serie y con detalle (incluidas las evidencias fotográficas). */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, USE_MOCK, type Cooler } from '@/api';
import { fmtFecha } from '@/lib/format';
import { colors, estadoColor, estadoLabel, radius, shadow, statusColor } from '@/theme';
import { Empty, Hero, Input, KeyValues, Loading, MiniButton, Muted, Tag, ViewHead } from '@/ui';

const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [serie, setSerie] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Cooler[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Cooler | null>(null);

  const cargar = useCallback(
    async (p: number, filtro: string) => {
      setCargando(true);
      setError(null);
      try {
        const r = await api.listCoolers({ page: p, pageSize: PAGE_SIZE, serie: filtro });
        setItems(r.items);
        setTotal(r.totalCount);
        setPage(r.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.');
        setItems([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      cargar(page, serie);
      // Solo al enfocar: buscar y paginar disparan su propia carga.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function buscar() {
    cargar(1, serie);
  }

  function confirmarLimpieza() {
    Alert.alert('Limpiar registros', '¿Borrar los registros locales y recargar los datos de demo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpiar',
        style: 'destructive',
        onPress: async () => {
          await api.resetDemo();
          cargar(1, serie);
        },
      },
    ]);
  }

  const ultimaPagina = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (cargando && !items.length) return <Loading text="Cargando historial…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 32 }}
        refreshing={cargando}
        onRefresh={() => cargar(page, serie)}
        ListHeaderComponent={
          <>
            <Hero kicker="Censo AAOCSA" title="Historial" />

            <View style={s.buscador}>
              <View style={{ flex: 1 }}>
                <Input
                  value={serie}
                  onChangeText={setSerie}
                  placeholder="Filtrar por serie…"
                  onSubmitEditing={buscar}
                />
              </View>
              <MiniButton onPress={buscar}>Buscar</MiniButton>
              {!!serie && (
                <MiniButton
                  onPress={() => {
                    setSerie('');
                    cargar(1, '');
                  }}
                >
                  Limpiar
                </MiniButton>
              )}
            </View>
            <ViewHead>
              <Muted>{total} registro(s)</Muted>
              {USE_MOCK && (
                <MiniButton danger onPress={confirmarLimpieza}>
                  Borrar demo
                </MiniButton>
              )}
            </ViewHead>
          </>
        }
        ListEmptyComponent={<Empty>{error ?? 'Aún no hay registros censados.'}</Empty>}
        ListFooterComponent={
          total > PAGE_SIZE ? (
            <View style={s.pager}>
              <MiniButton onPress={() => page > 1 && cargar(page - 1, serie)}>‹ Anterior</MiniButton>
              <Muted>
                Página {page} de {ultimaPagina}
              </Muted>
              <MiniButton onPress={() => page < ultimaPagina && cargar(page + 1, serie)}>
                Siguiente ›
              </MiniButton>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          // El punto sigue a tipoRegistro (CORRECTO/CORRECCION/NUEVO); el campo `status`
          // del backend es el estado físico y va en la pill, no aquí.
          const color = statusColor(item.tipoRegistro);
          return (
            <Pressable
              onPress={() => setDetalle(item)}
              style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}
            >
              <View style={[s.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.serie}>{item.serie}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {item.razonSocial ?? '—'} · {item.ruta ?? '—'} · {fmtFecha(item.created)}
                </Text>
                <Text style={s.sub}>
                  {item.subStatus ?? '—'}
                  {item.evidencias.length ? ` · ${item.evidencias.length} foto(s)` : ''}
                </Text>
              </View>
              {/* La pill muestra el estado físico (status del backend), con su propia paleta. */}
              <Tag text={estadoLabel(item.status)} color={estadoColor(item.status)} />
            </Pressable>
          );
        }}
      />

      <DetalleModal cooler={detalle} onClose={() => setDetalle(null)} />
    </View>
  );
}

/* Detalle: todos los campos que devuelve /coolers + sus evidencias. */
function DetalleModal({ cooler, onClose }: { cooler: Cooler | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!cooler) return null;

  const direccion = [cooler.calle, cooler.numero, cooler.colonia].filter(Boolean).join(' ');
  const rows: [string, string][] = [
    ['Serie', cooler.serie],
    ['Folio', String(cooler.folio)],
    ['Censo', `${String(cooler.censoMes).padStart(2, '0')}/${cooler.censoAnio}`],
    ['Estado', estadoLabel(cooler.status)],
    ['Tipo registro', cooler.tipoRegistro ?? '—'],
    ['Sub-status', cooler.subStatus ?? '—'],
    ['Ruta', cooler.ruta ?? '—'],
    ['UDN', cooler.udn ?? '—'],
    ['Cliente', cooler.idCliente ?? '—'],
    ['Razón social', cooler.razonSocial ?? '—'],
    ['Den. comercial', cooler.denComercial ?? '—'],
    ['Dirección', direccion || '—'],
    ['Frecuencia', cooler.frec ?? '—'],
    ['Comodato', cooler.comodato ?? '—'],
    ['Contrato', cooler.contrato ?? '—'],
    ['Descripción', cooler.descripcion ?? '—'],
    ['Marca', cooler.marca ?? '—'],
    ['Modelo', cooler.modelo ?? '—'],
    ['Tipo', cooler.tipoEnfri ?? '—'],
    ['Año', cooler.anio ?? '—'],
    ['GPS', cooler.latitud != null ? `${cooler.latitud}, ${cooler.longitud}` : '—'],
    ['Fecha', fmtFecha(cooler.created)],
    ['Observaciones', cooler.observaciones ?? '—'],
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={s.modalHead}>
          <Text style={s.modalTitle} numberOfLines={1}>
            {cooler.serie}
          </Text>
          <MiniButton onPress={onClose}>Cerrar</MiniButton>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <View style={s.card}>
            <KeyValues rows={rows} />
          </View>

          <Text style={s.section}>EVIDENCIAS ({cooler.evidencias.length})</Text>
          {cooler.evidencias.length ? (
            cooler.evidencias.map((e) => (
              <View key={e.id} style={s.foto}>
                <Image source={{ uri: e.url }} style={s.fotoImg} resizeMode="cover" />
                <Muted style={{ padding: 10 }}>{e.pie ?? 'Sin descripción'}</Muted>
              </View>
            ))
          ) : (
            <Empty>Este censo no tiene fotos.</Empty>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
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

  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },

  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 16, ...shadow },
  section: {
    marginTop: 20,
    marginBottom: 10,
    color: colors.text2,
    letterSpacing: 0.6,
    fontSize: 12,
    fontWeight: '700',
  },
  foto: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: 12,
    ...shadow,
  },
  fotoImg: { width: '100%', height: 220, backgroundColor: colors.card2 },
});
