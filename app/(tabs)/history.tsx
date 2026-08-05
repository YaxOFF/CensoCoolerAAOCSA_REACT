/* HistoryScreen — el parque de la ruta, en tres modos:
   · Censados  → GET /coolers?ruta=…   paginado y filtrable por serie
   · En FROG   → POST /frog/enfriadores  (el padrón completo de la ruta)
   · Faltantes → GET /coolers/faltantes  (padrón menos lo censado, §10)

   Los dos últimos devuelven filas crudas de FROG (llaves en MAYÚSCULAS, sin id ni
   evidencias) y no paginan: son decenas de filas y FlatList ya virtualiza. */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, USE_MOCK, type Cooler, type FrogRow } from '@/api';
import { fmtFecha } from '@/lib/format';
import { colors, estadoColor, estadoLabel, radius, shadow, statusColor } from '@/theme';
import { useSession } from '@/store/session';
import { Empty, Hero, Input, KeyValues, Loading, MiniButton, Muted, PrimaryButton, Segmented, Tag, ViewHead } from '@/ui';

const PAGE_SIZE = 20;

type Modo = 'censados' | 'frog' | 'faltantes';
type Fila = Cooler | FrogRow;

const MODOS: { key: Modo; label: string }[] = [
  { key: 'censados', label: 'Censados' },
  { key: 'frog', label: 'En FROG' },
  { key: 'faltantes', label: 'Faltantes' },
];

/** Las series de FROG vienen con prefijo `C_`; el censo usa la serie desnuda. */
const sinPrefijo = (s: string) => s.replace(/^C_/i, '').trim();

/** Solo los censos traen id: es lo que distingue un Cooler de una fila cruda de FROG. */
function esCooler(f: Fila): f is Cooler {
  return 'id' in f;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { ruta, udn } = useSession();
  const params = useLocalSearchParams<{ modo?: string }>();

  const [modo, setModo] = useState<Modo>('censados');
  const [serie, setSerie] = useState('');
  const [buscada, setBuscada] = useState(''); // la serie ya aplicada, no la que se teclea
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [tick, setTick] = useState(0);

  // El modo llega por query string desde las tarjetas del Inicio (/history?modo=frog).
  useEffect(() => {
    const m = params.modo;
    if (m === 'censados' || m === 'frog' || m === 'faltantes') {
      setModo(m);
      setPage(1);
    }
  }, [params.modo]);

  // Recargar al enfocar: el avance cambia al volver de guardar un censo.
  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    let vigente = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        if (modo === 'censados') {
          const r = await api.listCoolers({
            page,
            pageSize: PAGE_SIZE,
            serie: buscada,
            ruta: ruta ?? undefined,
          });
          if (!vigente) return;
          setItems(r.items);
          setTotal(r.totalCount);
        } else {
          const filas = ruta
            ? await (modo === 'frog'
                ? api.listFrog(ruta, udn ?? undefined)
                : api.listFaltantes(ruta, udn ?? undefined))
            : [];
          if (!vigente) return;
          setItems(filas);
          setTotal(filas.length);
        }
      } catch (e) {
        if (!vigente) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el listado.');
        setItems([]);
        setTotal(0);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [modo, page, buscada, ruta, udn, tick]);

  function buscar() {
    setPage(1);
    setBuscada(serie);
    setTick((t) => t + 1); // misma serie dos veces: fuerza la recarga
  }

  function confirmarLimpieza() {
    Alert.alert('Limpiar registros', '¿Borrar los registros locales y recargar los datos de demo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpiar',
        style: 'destructive',
        onPress: async () => {
          await api.resetDemo();
          setPage(1);
          setTick((t) => t + 1);
        },
      },
    ]);
  }

  const esCenso = modo === 'censados';
  const ultimaPagina = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (cargando && !items.length) return <Loading text="Cargando listado…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(f, i) => (esCooler(f) ? f.id : `${f.SERIE ?? 'sin-serie'}-${i}`)}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 32 }}
        refreshing={cargando}
        onRefresh={() => setTick((t) => t + 1)}
        ListHeaderComponent={
          <>
            <Hero kicker="Censo AAOCSA" title="Historial" />

            <View style={{ marginBottom: 14 }}>
              <Segmented
                options={MODOS}
                value={modo}
                onChange={(k) => {
                  setModo(k as Modo);
                  setPage(1);
                }}
              />
            </View>

            {/* Buscar por serie solo aplica al listado paginado del servidor. */}
            {esCenso && (
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
                {!!buscada && (
                  <MiniButton
                    onPress={() => {
                      setSerie('');
                      setBuscada('');
                      setPage(1);
                    }}
                  >
                    Limpiar
                  </MiniButton>
                )}
              </View>
            )}

            <ViewHead>
              <Muted>
                {total} {esCenso ? 'registro(s)' : 'equipo(s)'} · Ruta {ruta ?? '—'}
              </Muted>
              {USE_MOCK && esCenso && (
                <MiniButton danger onPress={confirmarLimpieza}>
                  Borrar demo
                </MiniButton>
              )}
            </ViewHead>
          </>
        }
        ListEmptyComponent={
          <Empty>
            {error ??
              (esCenso
                ? 'Aún no hay registros censados.'
                : modo === 'frog'
                  ? 'FROG no tiene equipos para esta ruta.'
                  : 'No quedan equipos por censar en esta ruta.')}
          </Empty>
        }
        ListFooterComponent={
          esCenso && total > PAGE_SIZE ? (
            <View style={s.pager}>
              <MiniButton onPress={() => page > 1 && setPage(page - 1)}>‹ Anterior</MiniButton>
              <Muted>
                Página {page} de {ultimaPagina}
              </Muted>
              <MiniButton onPress={() => page < ultimaPagina && setPage(page + 1)}>
                Siguiente ›
              </MiniButton>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDetalle(item)}
            style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}
          >
            {esCooler(item) ? <FilaCooler cooler={item} /> : <FilaFrog fila={item} />}
          </Pressable>
        )}
      />

      <DetalleModal fila={detalle} onClose={() => setDetalle(null)} />
    </View>
  );
}

function FilaCooler({ cooler }: { cooler: Cooler }) {
  // El punto sigue a tipoRegistro (CORRECTO/CORRECCION/NUEVO); el campo `status`
  // del backend es el estado físico y va en la pill, no aquí.
  return (
    <>
      <View style={[s.dot, { backgroundColor: statusColor(cooler.tipoRegistro) }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.serie}>{cooler.serie}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {cooler.razonSocial ?? '—'} · {cooler.ruta ?? '—'} · {fmtFecha(cooler.created)}
        </Text>
        <Text style={s.sub}>
          {cooler.subStatus ?? '—'}
          {cooler.evidencias.length ? ` · ${cooler.evidencias.length} foto(s)` : ''}
        </Text>
      </View>
      <Tag text={estadoLabel(cooler.status)} color={estadoColor(cooler.status)} />
    </>
  );
}

function FilaFrog({ fila }: { fila: FrogRow }) {
  return (
    <>
      <View style={[s.dot, { backgroundColor: colors.text2 }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.serie}>{fila.SERIE ?? '—'}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {fila.RAZONSOCIAL ?? '—'} · {fila.RUTA ?? '—'}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {fila.DESCRIPCION ?? '—'}
        </Text>
      </View>
      <Tag text="Sin censar" color={colors.text2} />
    </>
  );
}

function filasCooler(c: Cooler): [string, string][] {
  const direccion = [c.calle, c.numero, c.colonia].filter(Boolean).join(' ');
  return [
    ['Serie', c.serie],
    ['Folio', String(c.folio)],
    ['Censo', `${String(c.censoMes).padStart(2, '0')}/${c.censoAnio}`],
    ['Estado', estadoLabel(c.status)],
    ['Tipo registro', c.tipoRegistro ?? '—'],
    ['Sub-status', c.subStatus ?? '—'],
    ['Ruta', c.ruta ?? '—'],
    ['UDN', c.udn ?? '—'],
    ['Cliente', c.idCliente ?? '—'],
    ['Razón social', c.razonSocial ?? '—'],
    ['Den. comercial', c.denComercial ?? '—'],
    ['Dirección', direccion || '—'],
    ['Frecuencia', c.frec ?? '—'],
    ['Comodato', c.comodato ?? '—'],
    ['Contrato', c.contrato ?? '—'],
    ['Descripción', c.descripcion ?? '—'],
    ['Marca', c.marca ?? '—'],
    ['Modelo', c.modelo ?? '—'],
    ['Tipo', c.tipoEnfri ?? '—'],
    ['Año', c.anio ?? '—'],
    ['GPS', c.latitud != null ? `${c.latitud}, ${c.longitud}` : '—'],
    ['Fecha', fmtFecha(c.created)],
    ['Observaciones', c.observaciones ?? '—'],
  ];
}

function filasFrog(f: FrogRow): [string, string][] {
  const direccion = [f.CALLE, f.NUMERO, f.COLONIA].filter(Boolean).join(' ');
  return [
    ['Serie', f.SERIE ?? '—'],
    ['Comodato', f.COMODATO ?? '—'],
    ['Contrato', f.CONTRATO ?? '—'],
    ['UDN', f.UDN ?? '—'],
    ['Ruta', f.RUTA ?? '—'],
    ['Cliente', f.IDCLIENTE ?? '—'],
    ['Razón social', f.RAZONSOCIAL ?? '—'],
    ['Den. comercial', f.DENCOMERCIAL ?? '—'],
    ['Dirección', direccion || '—'],
    ['Frecuencia', f.FREC ?? '—'],
    ['Descripción', f.DESCRIPCION ?? '—'],
    ['Marca', f.MARCA ?? '—'],
    ['Modelo', f.MODELO ?? '—'],
    ['Tipo', f.TIPOENFRI ?? '—'],
    ['Año', f.ANIO ?? '—'],
    ['Sub-status', f.SUBSTATUS ?? '—'],
  ];
}

/* Detalle: los campos del censo con sus evidencias, o la ficha de FROG si el equipo
   todavía no se censa (ahí no hay fotos que mostrar). */
function DetalleModal({ fila, onClose }: { fila: Fila | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!fila) return null;

  const censo = esCooler(fila) ? fila : null;
  const rows = censo ? filasCooler(censo) : filasFrog(fila as FrogRow);
  const titulo = censo ? censo.serie : ((fila as FrogRow).SERIE ?? '—');
  // Acceso directo: solo tiene sentido en lo que aún no se censa (En FROG / Faltantes).
  const serieACensar = censo ? '' : sinPrefijo(titulo === '—' ? '' : titulo);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={s.modalHead}>
          <Text style={s.modalTitle} numberOfLines={1}>
            {titulo}
          </Text>
          <MiniButton onPress={onClose}>Cerrar</MiniButton>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <View style={s.card}>
            <KeyValues rows={rows} />
          </View>

          {censo && (
            <>
              <Text style={s.section}>EVIDENCIAS ({censo.evidencias.length})</Text>
              {censo.evidencias.length ? (
                censo.evidencias.map((e) => (
                  <View key={e.id} style={s.foto}>
                    <Image source={{ uri: e.url }} style={s.fotoImg} resizeMode="cover" />
                    <Muted style={{ padding: 10 }}>{e.pie ?? 'Sin descripción'}</Muted>
                  </View>
                ))
              ) : (
                <Empty>Este censo no tiene fotos.</Empty>
              )}
            </>
          )}

          {!!serieACensar && (
            <View style={{ marginTop: 20 }}>
              <PrimaryButton
                onPress={() => {
                  onClose();
                  // `n`: expo-router conserva los params de la pestaña, así que sin nonce
                  // mandar la misma serie dos veces no volvería a llenar el campo.
                  router.push({
                    pathname: '/(tabs)/search',
                    params: { serie: serieACensar, n: String(Date.now()) },
                  });
                }}
              >
                Censar este equipo
              </PrimaryButton>
            </View>
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
