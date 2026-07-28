/* Self-check de las reglas de negocio. Sin framework de test:
      npm run check

   Si cambias una regla del spec, esta es la red que avisa si rompiste otra.
   Solo importa código puro (rules.ts + types.ts): nada de React ni de expo. */

import type { Catalogos, Enfriador, RegistroCenso } from '../api/types.ts';

/* Assert mínimo propio: node:assert no resuelve bajo la config de módulos de Expo. */
const assert = {
  equal(actual: unknown, esperado: unknown, mensaje = '') {
    if (actual !== esperado) {
      throw new Error(`✗ ${mensaje}\n   esperado: ${JSON.stringify(esperado)}\n   recibido: ${JSON.stringify(actual)}`);
    }
  },
  deepEqual(actual: unknown, esperado: unknown, mensaje = '') {
    assert.equal(JSON.stringify(actual), JSON.stringify(esperado), mensaje);
  },
};
import {
  BODEGA,
  aplicarEnPiso,
  camposEditables,
  construirCsv,
  construirReporte,
  construirResumen,
  resolverStatus,
  upsertRegistro,
  validarDraft,
} from './rules.ts';
import { normalizarVersion } from './version.ts';

const CATALOGOS: Catalogos = {
  tipos: ['AAOCSA', 'PEÑAFIEL'],
  estadosEnfriador: ['Usado Disponible', 'Descompuesto', 'Obsoleto', 'En Piso'],
  cedis: ['CEDIS Norte', 'CEDIS Sur'],
  rutas: ['R-101'],
  marcas: ['Imbera'],
};

const frog = (numeroSerie: string, cedis = 'CEDIS Norte'): Enfriador => ({
  numeroSerie,
  numeroCliente: 'CL-1',
  nombreCliente: 'Tienda',
  direccion: 'Calle 1',
  cedis,
  ruta: 'R-101',
  marca: 'Imbera',
  modelo: 'VR-08',
  tipo: 'AAOCSA',
});

const censo = (numeroSerie: string, over: Partial<RegistroCenso> = {}): RegistroCenso => ({
  ...frog(numeroSerie),
  status: 'CORRECTO',
  estadoEnfriador: 'Usado Disponible',
  observaciones: '',
  lat: 19.4,
  lng: -99.1,
  fecha: '2026-07-21T10:00:00.000Z',
  usuario: 'test',
  censado: 'SI',
  fotos: [],
  ...over,
});

/* Regla 1 (§5) — el status sale de la existencia en FROG + la validación del usuario. */
assert.equal(resolverStatus(false, null), 'NUEVO', 'serie inexistente => NUEVO');
assert.equal(resolverStatus(true, 'ok'), 'CORRECTO');
assert.equal(resolverStatus(true, 'fix'), 'CORRECCIÓN');
assert.equal(resolverStatus(true, null), null, 'sin validar todavía no hay status');

/* Regla 2 (§6) — solo CORRECTO bloquea los campos. */
assert.equal(camposEditables('CORRECTO'), false);
assert.equal(camposEditables('CORRECCIÓN'), true);
assert.equal(camposEditables('NUEVO'), true);

/* Regla 3 (§12.2) — En Piso fuerza BODEGA y al salir restaura lo anterior. */
const clienteReal = { numeroCliente: 'CL-4471', nombreCliente: 'Abarrotes La Esquina' };
const enPiso = aplicarEnPiso('En Piso', clienteReal, null);
assert.deepEqual(enPiso.patch, { numeroCliente: BODEGA, nombreCliente: BODEGA });
assert.equal(enPiso.bloqueado, true);
assert.deepEqual(enPiso.previo, clienteReal, 'guarda el cliente para poder restaurarlo');

const salioDeEnPiso = aplicarEnPiso(
  'Descompuesto',
  { numeroCliente: BODEGA, nombreCliente: BODEGA },
  enPiso.previo
);
assert.deepEqual(salioDeEnPiso.patch, clienteReal, 'al salir de En Piso vuelve el cliente original');
assert.equal(salioDeEnPiso.bloqueado, false);
assert.equal(salioDeEnPiso.previo, null);

// Entrar dos veces a En Piso no debe pisar el respaldo con BODEGA.
const dobleEnPiso = aplicarEnPiso('En Piso', { numeroCliente: BODEGA, nombreCliente: BODEGA }, enPiso.previo);
assert.deepEqual(dobleEnPiso.previo, clienteReal, 'el respaldo no se sobrescribe con BODEGA');

/* Regla 4 (§12.1) — el estado del enfriador es obligatorio. */
assert.equal(
  validarDraft({ numeroSerie: 'A-1', status: 'CORRECTO', estadoEnfriador: '' }),
  'El estado del enfriador es obligatorio.'
);
assert.equal(validarDraft({ numeroSerie: 'A-1', status: null, estadoEnfriador: 'Obsoleto' }) !== null, true);
assert.equal(validarDraft({ numeroSerie: '', status: 'NUEVO', estadoEnfriador: 'Obsoleto' }) !== null, true);
assert.equal(validarDraft({ numeroSerie: 'A-1', status: 'NUEVO', estadoEnfriador: 'Obsoleto' }), null);

/* Regla 6 (§8) — guardar reemplaza por número de serie, no duplica. */
const base = [censo('A-1'), censo('B-2')];
const reemplazado = upsertRegistro(base, censo('A-1', { estadoEnfriador: 'Obsoleto' }));
assert.equal(reemplazado.length, 2, 'no duplica la serie existente');
assert.equal(reemplazado[0].estadoEnfriador, 'Obsoleto', 'reemplaza el registro previo');
assert.equal(upsertRegistro(base, censo('C-3')).length, 3, 'una serie nueva se agrega');
assert.equal(base.length, 2, 'no muta la lista original');

/* Regla 5 y 7 (§9, §10) — avance y universo del reporte. */
const FROG_TEST = [frog('A-1'), frog('B-2', 'CEDIS Sur'), frog('C-3')];
const registros = [censo('A-1'), censo('NUEVA-9', { status: 'NUEVO' })];
const resumen = construirResumen(registros, FROG_TEST, CATALOGOS);

assert.equal(resumen.totalFrog, 3);
assert.equal(resumen.censados, 2, 'cuenta todos los levantamientos, incluidos los nuevos');
assert.equal(resumen.pendientes, 2, 'B-2 y C-3 siguen sin censar');
assert.equal(resumen.porcentaje, 33, '1 de 3 equipos de FROG censados');
assert.equal(resumen.porStatus.NUEVO, 1);
assert.equal(resumen.porStatus.CORRECTO, 1);
assert.equal(
  resumen.porEstado.length,
  CATALOGOS.estadosEnfriador.length,
  'la distribución muestra el catálogo completo aunque esté en cero'
);

const reporte = construirReporte(registros, FROG_TEST, CATALOGOS);
assert.equal(reporte.filas.length, 4, 'censados (2) + pendientes de FROG (2)');
assert.equal(reporte.filas.filter((f) => f.censado === 'NO').length, 2);
assert.equal(
  reporte.filas.filter((f) => f.censado === 'NO').every((f) => f.status === ''),
  true,
  'los pendientes no traen status'
);

/* CSV — encabezado, BOM y escape de comillas para que Excel no se rompa. */
const csv = construirCsv(
  construirReporte([censo('A-1', { observaciones: 'Dice "urgente", falta parrilla' })], FROG_TEST, CATALOGOS).filas
);
assert.equal(csv.startsWith('﻿'), true, 'lleva BOM para los acentos en Excel');
assert.equal(csv.includes('"Dice ""urgente"", falta parrilla"'), true, 'escapa las comillas dobles');
assert.equal(csv.split('\r\n').length, 4, 'encabezado + 3 filas');

console.log('✓ reglas del censo OK');

/* ── version.json del servidor de updates (borde de confianza) ─────────────── */
const BASE = 'https://files.censo.aaocsa.com/app-release';
assert.equal(normalizarVersion(null, BASE), null, 'JSON no-objeto ⇒ null');
assert.equal(normalizarVersion({ versionName: '1.1' }, BASE), null, 'sin versionCode ⇒ null');
assert.equal(normalizarVersion({ versionCode: 2 }, BASE), null, 'sin apkUrl ⇒ null');
assert.equal(normalizarVersion({ versionCode: '2.5', apkUrl: 'a.apk' }, BASE), null, 'versionCode no entero ⇒ null');
assert.equal(
  normalizarVersion({ versionCode: 2, apkUrl: '/a.apk' }, BASE)?.apkUrl,
  `${BASE}/a.apk`,
  'apkUrl relativa cuelga del servidor de updates, sin doble diagonal'
);
assert.equal(
  normalizarVersion({ versionCode: 2, apkUrl: 'https://otro/x.apk' }, BASE)?.apkUrl,
  'https://otro/x.apk',
  'apkUrl absoluta se respeta'
);
assert.equal(normalizarVersion({ versionCode: 2, apkUrl: 'a.apk' }, BASE)?.forceUpdate, false, 'forceUpdate default false');
assert.equal(
  normalizarVersion({ versionCode: 2, apkUrl: 'a.apk', forceUpdate: 'true' }, BASE)?.forceUpdate,
  false,
  'forceUpdate solo con booleano true, no con la cadena'
);

console.log('✓ version.json OK');
