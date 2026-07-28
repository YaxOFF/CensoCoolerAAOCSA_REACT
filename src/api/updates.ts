/* Auto-actualización del APK. La app se reparte fuera de Play Store, así que el
   servidor de Nginx publica un version.json junto al .apk y la app se compara
   contra él al arrancar.

   No usa react-native-update-apk: expo-file-system ya trae descarga con progreso
   y su propio FileProvider (${applicationId}.FileSystemFileProvider), y
   expo-intent-launcher lanza el instalador del sistema. Todo con módulos de Expo,
   sin editar android/ a mano — que es lo que importa aquí porque `expo prebuild`
   regenera esa carpeta (ver COMPILAR.md).

   Fetch vive en src/api/ por la regla dura de arquitectura: ninguna pantalla
   llama a la red. No pasa por client.ts porque el servidor de archivos no es el
   backend del censo: otra URL base, sin token, y su caída no es "estar sin red". */

import * as Application from 'expo-application';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { normalizarVersion, type VersionRemota } from '@/lib/version';

export type { VersionRemota };

/** Servidor de distribución. Se cambia en .env sin tocar código. */
export const UPDATE_SERVER_URL =
  process.env.EXPO_PUBLIC_UPDATE_URL ?? 'https://files.censo.aaocsa.com/app-release';

const VERSION_JSON = `${UPDATE_SERVER_URL}/version.json`;
const TIMEOUT_MS = 10000;

export class UpdateError extends Error {
  constructor(
    message: string,
    readonly causa: 'red' | 'json' | 'descarga' | 'instalacion'
  ) {
    super(message);
    this.name = 'UpdateError';
  }
}

/** versionCode instalado. En Android es el nativeBuildVersion; viene como string. */
export function versionInstalada(): number {
  return Number(Application.nativeBuildVersion) || 0;
}

export function versionNombreInstalada(): string {
  return Application.nativeApplicationVersion ?? '—';
}

/**
 * Consulta version.json. Devuelve null si no hay actualización (o si la
 * plataforma no es Android: el flujo de APK es solo de Android).
 * Lanza UpdateError si el servidor no contesta o el JSON viene mal.
 */
export async function buscarActualizacion(): Promise<VersionRemota | null> {
  if (Platform.OS !== 'android') return null;

  let texto: string;
  try {
    const res = await fetch(VERSION_JSON, {
      // Sin caché: Nginx sirve el JSON estático y el navegador de RN lo cachearía.
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new UpdateError(`El servidor respondió ${res.status}.`, 'red');
    texto = await res.text();
  } catch (e) {
    if (e instanceof UpdateError) throw e;
    throw new UpdateError('No se pudo contactar el servidor de actualizaciones.', 'red');
  }

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new UpdateError('El servidor devolvió un version.json inválido.', 'json');
  }

  const v = normalizarVersion(json, UPDATE_SERVER_URL);
  if (!v) throw new UpdateError('El version.json no tiene los campos esperados.', 'json');

  return v.versionCode > versionInstalada() ? v : null;
}

/**
 * Descarga el APK a la caché y abre el instalador del sistema.
 * `onProgreso` recibe 0..1; -1 cuando el servidor no manda Content-Length.
 *
 * El instalador corre en otro proceso: esta promesa resuelve al lanzarlo, no al
 * terminar la instalación. Si el usuario cancela, la app sigue viva y el modal
 * vuelve a quedar visible — no hay forma de distinguir "canceló" de "instaló"
 * sin salir de la app, y no hace falta: al reabrir, el versionCode ya coincide.
 */
export async function descargarEInstalar(
  v: VersionRemota,
  onProgreso?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const destino = new File(new Directory(Paths.cache), `censo-${v.versionCode}.apk`);

  let apk: File;
  try {
    // Una descarga interrumpida deja el archivo a medias en Android: idempotent
    // para que el reintento lo pise en vez de fallar con DestinationAlreadyExists.
    apk = await File.downloadFileAsync(v.apkUrl, destino, {
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten, totalBytes }) =>
        onProgreso?.(totalBytes > 0 ? bytesWritten / totalBytes : -1),
    });
  } catch {
    borrar(destino);
    throw new UpdateError('La descarga se interrumpió. Revisa tu conexión.', 'descarga');
  }

  if (apk.info().size === 0) {
    borrar(destino);
    throw new UpdateError('El APK descargado llegó vacío.', 'descarga');
  }

  try {
    // El instalador es otra app: necesita un content:// con permiso de lectura,
    // un file:// truena con FileUriExposedException desde Android 7.
    const uri = await getContentUriAsync(apk.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: uri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch {
    throw new UpdateError(
      'No se pudo abrir el instalador. Permite "Instalar apps desconocidas" para CensoCooler y reintenta.',
      'instalacion'
    );
  }
}

/** delete() truena si el archivo no existe; aquí borrar restos nunca debe tumbar el flujo. */
function borrar(f: File) {
  if (f.exists) f.delete();
}

/**
 * Abre los ajustes de "Instalar apps desconocidas" de esta app.
 *
 * ponytail: no consultamos PackageManager.canRequestPackageInstalls() —no hay API
 * de Expo que lo exponga— así que en vez de preguntar antes, dejamos que el
 * instalador del sistema pida el permiso él mismo y ofrecemos este botón como
 * salida cuando el intent falla. Si algún día hace falta el check previo, es un
 * módulo nativo de 10 líneas.
 */
export async function abrirAjustesInstalacion(): Promise<void> {
  await IntentLauncher.startActivityAsync(
    'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
    { data: `package:${Application.applicationId}` }
  );
}
