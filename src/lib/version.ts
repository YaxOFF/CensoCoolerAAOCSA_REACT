/* Parseo del version.json del servidor de updates. Vive aquí y no en
   src/api/updates.ts para que sea código puro y lo cubra `npm run check`: es un
   parser de JSON ajeno, o sea un borde de confianza — nada de lo que venga en la
   respuesta se usa sin validar. */

export interface VersionRemota {
  /** android.versionCode de la build publicada. Es el número que manda al comparar. */
  versionCode: number;
  /** Solo para mostrar ("1.2.0"). */
  versionName: string;
  /** URL absoluta del .apk. */
  apkUrl: string;
  /** Changelog que ve el inspector. */
  whatsNew?: string;
  /** true ⇒ la app queda bloqueada hasta actualizar. */
  forceUpdate?: boolean;
}

/** Devuelve null si el JSON no trae lo mínimo (versionCode válido + apkUrl). */
export function normalizarVersion(json: unknown, baseUrl: string): VersionRemota | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const versionCode = Number(o.versionCode);
  const apkUrl = typeof o.apkUrl === 'string' ? o.apkUrl.trim() : '';
  if (!Number.isInteger(versionCode) || versionCode <= 0 || !apkUrl) return null;
  return {
    versionCode,
    versionName: String(o.versionName ?? versionCode),
    // apkUrl relativa ⇒ cuelga del servidor de updates; absoluta ⇒ se respeta.
    apkUrl: /^https?:\/\//.test(apkUrl)
      ? apkUrl
      : `${baseUrl.replace(/\/$/, '')}/${apkUrl.replace(/^\//, '')}`,
    whatsNew: typeof o.whatsNew === 'string' ? o.whatsNew : undefined,
    forceUpdate: o.forceUpdate === true,
  };
}
