/* Componentes base de la app: la traducción de styles.css a React Native.

   Todo vive en un archivo porque son piezas chicas que siempre se usan juntas.
   No hay librería de UI a propósito: la demo define su propio lenguaje visual. */

import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ToastAndroid,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, statusColor, tint, titulo } from '../theme';

/* ── Textos ───────────────────────────────────────────────────────────── */

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}

/** Encabezado de sección en mayúsculas (.sect de la demo). */
export function Section({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{String(children).toUpperCase()}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={s.hint}>{children}</Text>;
}

/* ── Contenedores ─────────────────────────────────────────────────────── */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Hero({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <View style={s.hero}>
      {!!kicker && <Text style={s.heroKicker}>{kicker.toUpperCase()}</Text>}
      <H1>{title}</H1>
      {!!sub && <Text style={s.heroSub}>{sub}</Text>}
    </View>
  );
}

export function ViewHead({ children }: { children: ReactNode }) {
  return <View style={s.viewHead}>{children}</View>;
}

/* ── Botones ──────────────────────────────────────────────────────────── */

/** Nombre de icono de Ionicons (@expo/vector-icons). */
export type IconName = ComponentProps<typeof Ionicons>['name'];

interface BtnProps {
  onPress: () => void;
  children: ReactNode;
  /** Icono opcional a la izquierda del texto. */
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/* El icono va dentro del <Text> del botón: así hereda tamaño de línea y
   centrado sin envolver todo en una View extra. Los márgenes no funcionan en
   <Text> anidados en Android, de ahí el espacio literal. */
function Icono({ name }: { name?: IconName }) {
  if (!name) return null;
  return (
    <Text>
      <Ionicons name={name} size={17} />
      {'  '}
    </Text>
  );
}

export function PrimaryButton({ onPress, children, icon, disabled, loading, style }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btnPrimary,
        pressed && s.btnPrimaryPressed,
        (disabled || loading) && s.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={s.btnPrimaryText}>
          <Icono name={icon} />
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ onPress, children, icon, style }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.btnSecondary, pressed && { backgroundColor: colors.card2 }, style]}
    >
      <Text style={s.btnSecondaryText}>
        <Icono name={icon} />
        {children}
      </Text>
    </Pressable>
  );
}

export function GhostButton({ onPress, children, icon, style, disabled }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btnGhost, pressed && { opacity: 0.6 }, disabled && s.btnDisabled, style]}
    >
      <Text style={s.btnGhostText}>
        <Icono name={icon} />
        {children}
      </Text>
    </Pressable>
  );
}

export function MiniButton({
  onPress,
  children,
  danger,
}: BtnProps & { danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btnMini, pressed && { opacity: 0.6 }]}>
      <Text style={[s.btnMiniText, danger && { color: colors.red }]}>{children}</Text>
    </Pressable>
  );
}

export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, pressed && s.chipPressed]}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

/* ── Campos de formulario ─────────────────────────────────────────────── */

export function Field({
  label,
  required,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.red }}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline,
  autoCapitalize = 'characters',
  onSubmitEditing,
}: {
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text2}
      editable={editable}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      onSubmitEditing={onSubmitEditing}
      style={[s.input, multiline && s.inputMultiline, !editable && s.inputDisabled]}
    />
  );
}

/** Selector por chips: en móvil se toca más rápido que un <select> nativo. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = '— Selecciona —',
  disabled,
}: {
  value: T | '';
  options: readonly T[];
  onChange: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <View style={s.selectWrap}>
      {!value && <Text style={s.selectPlaceholder}>{placeholder}</Text>}
      <View style={s.selectRow}>
        {options.map((opt) => {
          const on = opt === value;
          return (
            <Pressable
              key={opt}
              disabled={disabled}
              onPress={() => onChange(opt)}
              style={[s.selectOpt, on && s.selectOptOn, disabled && { opacity: 0.5 }]}
            >
              <Text style={[s.selectOptText, on && s.selectOptTextOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Combobox desplegable: para catálogos largos donde los chips del Select no caben (ej. CEDIS). */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = '— Selecciona —',
  disabled,
  label = (v) => v,
  onOpen,
  loading,
  vacio = 'Sin opciones.',
}: {
  value: T | '';
  options: readonly T[];
  onChange: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: (v: T) => string;
  /** Se dispara al abrir: aquí se cargan las opciones que se consultan bajo demanda. */
  onOpen?: () => void;
  loading?: boolean;
  vacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setAbierto(true);
          onOpen?.();
        }}
        style={[s.input, s.ddBtn, disabled && { opacity: 0.5 }]}
      >
        <Text style={value ? s.ddValue : s.ddPlaceholder} numberOfLines={1}>
          {value ? label(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.text2} />
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={s.ddBackdrop} onPress={() => setAbierto(false)}>
          <Pressable style={s.ddSheet} onPress={() => {}}>
            {loading && <Loading />}
            {!loading && options.length === 0 && (
              <Text style={[s.ddItemText, { padding: 20, textAlign: 'center', color: colors.text2 }]}>
                {vacio}
              </Text>
            )}
            <ScrollView>
              {(loading ? [] : options).map((opt) => {
                const on = opt === value;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      onChange(opt);
                      setAbierto(false);
                    }}
                    style={[s.ddItem, on && s.ddItemOn]}
                  >
                    <Text style={[s.ddItemText, on && s.ddItemTextOn]}>{label(opt)}</Text>
                    {on && <Ionicons name="checkmark" size={18} color={colors.blue} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Control segmentado de dos opciones (validación correcto/corrección). */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segBtn, on && s.segBtnOn]}>
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Indicadores ──────────────────────────────────────────────────────── */

export function Badge({ text, color }: { text: string; color?: string }) {
  const c = color ?? statusColor(text);
  return (
    <View style={[s.badge, { backgroundColor: tint(c) }]}>
      <Text style={[s.badgeText, { color: c }]}>{text}</Text>
    </View>
  );
}

export function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.tag, { backgroundColor: tint(color) }]}>
      <Text style={[s.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export function StatRow({
  items,
}: {
  items: { valor: string | number; etiqueta: string; color?: string; onPress?: () => void }[];
}) {
  return (
    <View style={s.statRow}>
      {items.map((it) => (
        // Sin onPress se queda como View: las tarjetas que no llevan a ningún lado
        // no deben dar feedback táctil.
        <Pressable
          key={it.etiqueta}
          onPress={it.onPress}
          disabled={!it.onPress}
          style={({ pressed }) => [s.stat, pressed && it.onPress ? { opacity: 0.7 } : null]}
        >
          <Text style={[s.statValue, it.color ? { color: it.color } : null]}>{it.valor}</Text>
          <Text style={s.statLabel}>{it.etiqueta}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Filas clave/valor (.kv de la demo). */
/** `copiable`: tap o pulsación larga sobre la fila copia el valor al portapapeles. */
export function KeyValues({ rows, copiable }: { rows: [string, string][]; copiable?: boolean }) {
  return (
    <View style={s.kv}>
      {rows.map(([k, v], i) => {
        const estilo = [s.kvRow, i === rows.length - 1 && { borderBottomWidth: 0 }];
        if (!copiable) {
          return (
            <View key={k} style={estilo}>
              <Text style={s.kvKey}>{k}</Text>
              <Text style={s.kvValue}>{v}</Text>
            </View>
          );
        }
        const copiar = () => copiarAlPortapapeles(v, k);
        return (
          <Pressable
            key={k}
            onPress={copiar}
            onLongPress={copiar}
            style={({ pressed }) => [...estilo, pressed && { backgroundColor: colors.card2 }]}
          >
            <Text style={s.kvKey}>{k}</Text>
            <Text style={s.kvValue}>{v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Nada que copiar si el campo está vacío o es el guion de "sin dato". */
async function copiarAlPortapapeles(valor: string, etiqueta: string) {
  const v = valor?.trim();
  if (!v || v === '—') return;
  await Clipboard.setStringAsync(v);
  const msg = `${etiqueta} copiado al portapapeles`;
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
}

/** Barras de distribución del dashboard y del reporte. */
export function DistBars({
  data,
  total,
  color,
}: {
  data: { etiqueta: string; total: number }[];
  total: number;
  color: string;
}) {
  if (!data.length) return <Muted style={{ padding: 12 }}>Sin datos.</Muted>;
  return (
    <View style={s.dist}>
      {data.map((d, i) => (
        <View key={d.etiqueta} style={[s.distRow, i === data.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={s.distLabel}>
            <Text style={s.distText}>{d.etiqueta}</Text>
            <Text style={s.distNum}>{d.total}</Text>
          </View>
          <View style={s.miniBar}>
            <View
              style={[
                s.miniFill,
                { width: `${total ? Math.round((d.total / total) * 100) : 0}%`, backgroundColor: color },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={s.bar}>
      <View style={[s.barFill, { width: `${Math.min(Math.max(pct, 0), 100)}%` }]} />
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={s.note}>
      <Text style={s.noteText}>
        <Ionicons name="warning-outline" size={14} />
        {'  '}
        {children}
      </Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.blue} />
      <Muted style={{ marginTop: 8 }}>{text}</Muted>
    </View>
  );
}

/** Contenedor con scroll y el padding estándar de las pantallas.
    Con edge-to-edge en Android el contenido corre por debajo de la barra de
    estado y de la de gestos: se suman los insets al padding.
    `top` solo en pantallas sin header (el header ya reserva ese espacio).
    Con `onRefresh` habilita el jalar-para-recargar, como el FlatList del Historial. */
export function Screen({
  children,
  top = false,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  top?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        ) : undefined
      }
      contentContainerStyle={[
        s.screen,
        {
          paddingTop: (top ? insets.top : 0) + 16,
          paddingBottom: insets.bottom + 40,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/* ── Estilos ──────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40 },

  h1: titulo,
  h2: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  section: {
    marginTop: 24,
    marginBottom: 10,
    marginHorizontal: 4,
    color: colors.text2,
    letterSpacing: 0.6,
    fontSize: 12,
    fontWeight: '700',
  },
  muted: { color: colors.text2, fontSize: 14 },
  hint: { color: colors.text2, fontSize: 12, textAlign: 'center', marginTop: 22, lineHeight: 18 },

  hero: { paddingHorizontal: 4, paddingTop: 12, paddingBottom: 22 },
  heroKicker: { color: colors.blue, fontWeight: '700', fontSize: 13, letterSpacing: 0.8 },
  heroSub: { color: colors.text2, marginTop: 6, fontSize: 15 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    ...shadow,
  },
  viewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 4,
    marginBottom: 14,
  },

  btnPrimary: {
    backgroundColor: colors.blue,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: radius.control,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPrimaryPressed: { backgroundColor: colors.blueDark },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },

  btnSecondary: {
    backgroundColor: colors.card,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: radius.control,
    ...shadow,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 16 },

  btnGhost: {
    backgroundColor: colors.card2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.blue, fontWeight: '600', fontSize: 15 },

  btnMini: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.card2 },
  btnMiniText: { fontSize: 13, fontWeight: '600', color: colors.text },

  chip: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  chipPressed: { backgroundColor: colors.blue },
  chipText: { color: colors.blue, fontSize: 13, fontWeight: '600' },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text2, marginBottom: 6 },
  input: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  inputDisabled: { opacity: 0.55 },

  selectWrap: { gap: 6 },
  selectPlaceholder: { color: colors.text2, fontSize: 13 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectOpt: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  selectOptOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  selectOptText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  selectOptTextOn: { color: '#fff' },

  ddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ddValue: { flex: 1, color: colors.text, fontSize: 16 },
  ddPlaceholder: { flex: 1, color: colors.text2, fontSize: 16 },
  ddBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  ddSheet: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    maxHeight: '70%',
    overflow: 'hidden',
    ...shadow,
  },
  ddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  ddItemOn: { backgroundColor: colors.card2 },
  ddItemText: { color: colors.text, fontSize: 15 },
  ddItemTextOn: { color: colors.blue, fontWeight: '700' },

  seg: { flexDirection: 'row', gap: 4, backgroundColor: colors.card2, borderRadius: radius.input, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.card, ...shadow },
  segText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  segTextOn: { color: colors.blue },

  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },

  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...shadow,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: colors.text2, textAlign: 'center' },

  kv: { marginTop: 4, marginBottom: 14 },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  kvKey: { color: colors.text2, fontSize: 14 },
  kvValue: { fontWeight: '600', fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' },

  dist: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...shadow,
  },
  distRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  distLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  distText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  distNum: { fontSize: 14, fontWeight: '700', color: colors.text },
  miniBar: { height: 7, backgroundColor: colors.card2, borderRadius: radius.pill, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: radius.pill },

  bar: {
    height: 12,
    backgroundColor: colors.card2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginVertical: 12,
  },
  barFill: { height: '100%', backgroundColor: colors.blue, borderRadius: radius.pill },

  note: { backgroundColor: tint(colors.amber), borderRadius: 10, padding: 12, marginBottom: 14 },
  noteText: { color: '#8a5a00', fontSize: 13, fontWeight: '500' },

  empty: { textAlign: 'center', color: colors.text2, paddingVertical: 40, paddingHorizontal: 20 },
  loading: { paddingVertical: 40, alignItems: 'center' },
});
