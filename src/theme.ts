/* Lenguaje visual de la demo (styles.css) traducido a constantes de RN.
   La app está fija en modo claro, igual que la demo. */

export const colors = {
  blue: '#0A84FF',
  blueDark: '#0060df',
  green: '#34C759',
  amber: '#FF9F0A',
  red: '#FF3B30',
  purple: '#AF52DE',

  bg: '#F2F2F7',
  card: '#FFFFFF',
  card2: '#F7F7FA',
  text: '#1C1C1E',
  text2: '#6C6C70',
  line: '#E3E3E8',
} as const;

/* Tipografía del título de vista. Se define aquí porque la usan tanto el <Hero>
   de las pantallas como los headers nativos de los dos layouts. */
export const titulo = {
  fontSize: 34,
  fontWeight: '800',
  letterSpacing: -0.5,
  color: colors.text,
} as const;

export const radius = {
  card: 16,
  control: 14,
  input: 12,
  pill: 999,
} as const;

export const spacing = {
  screen: 16,
  gap: 12,
} as const;

/* Sombra de las tarjetas: en iOS es shadow*, en Android elevation. */
export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/* Color por status del registro — mismo criterio que statusColor() de shared.js. */
export function statusColor(status?: string | null): string {
  // El backend manda tipoRegistro sin acento ("CORRECCION"); se normaliza aquí.
  const s = normalizar(status);
  if (s === 'CORRECTO') return colors.green;
  if (s === 'CORRECCION') return colors.amber;
  if (s === 'NUEVO') return colors.purple;
  return colors.text2;
}

/* Color por estado físico del enfriador (§12.1). Es otra dimensión que el status
   del registro, así que tiene su propia paleta: azul = operativo, rojo = falla,
   gris = fuera de uso, ámbar = en CEDIS sin cliente. */
export function estadoColor(estado?: string | null): string {
  switch (normalizar(estado)) {
    case 'USADO_DISPONIBLE':
      return colors.blue;
    case 'DESCOMPUESTO':
      return colors.red;
    case 'OBSOLETO':
      return colors.text2;
    case 'EN_PISO':
      return colors.amber;
    case 'ACTA_HECHOS':
      return colors.purple;
    default:
      return colors.text2;
  }
}

/* "USADO_DISPONIBLE" → "Usado disponible" para la pill. */
export function estadoLabel(estado?: string | null): string {
  if (!estado) return '—';
  const t = estado.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* Sin acentos, MAYÚSCULAS y con "_" — el backend y la app escriben distinto. */
function normalizar(v?: string | null): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/* Fondo tenue del mismo color (equivale al sufijo "22" de la demo). */
export function tint(color: string): string {
  return color + '22';
}
