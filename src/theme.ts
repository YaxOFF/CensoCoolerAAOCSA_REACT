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
export function statusColor(status?: string): string {
  if (status === 'CORRECTO') return colors.green;
  if (status === 'CORRECCIÓN') return colors.amber;
  if (status === 'NUEVO') return colors.purple;
  return colors.text2;
}

/* Fondo tenue del mismo color (equivale al sufijo "22" de la demo). */
export function tint(color: string): string {
  return color + '22';
}
