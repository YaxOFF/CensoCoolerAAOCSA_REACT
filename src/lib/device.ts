/* Acceso al hardware del teléfono: GPS y cámara.

   Regla: ninguna pantalla pide permisos ni maneja el caso "permiso negado".
   Aquí siempre se devuelve algo utilizable — con `mock: true` cuando es simulado —
   para que el censo nunca se atore por un permiso en un emulador o un equipo viejo. */

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { gpsMock } from '../api/mock';
import type { Foto, Gps, TipoFoto } from '../api/types';

/** Prefijo de una foto simulada: la UI dibuja un recuadro de color en vez de la imagen. */
export const FOTO_MOCK = 'mock://';

export function esFotoMock(uri: string): boolean {
  return uri.startsWith(FOTO_MOCK);
}

/** §12.3 — ubicación del levantamiento. Nunca falla: cae a coordenadas simuladas. */
export async function obtenerGps(semilla = 0): Promise<Gps> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return gpsMock(semilla);

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, mock: false };
  } catch {
    return gpsMock(semilla);
  }
}

/** §7 — evidencia fotográfica. Sin cámara disponible devuelve una foto simulada. */
export async function tomarFoto(tipo: TipoFoto): Promise<Foto> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return { tipo, uri: `${FOTO_MOCK}${tipo}` };

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: false,
      // La evidencia se sube tal cual; no se pide base64 para no inflar memoria.
    });
    if (res.canceled || !res.assets?.length) return { tipo, uri: '' };
    return { tipo, uri: res.assets[0].uri };
  } catch {
    return { tipo, uri: `${FOTO_MOCK}${tipo}` };
  }
}
