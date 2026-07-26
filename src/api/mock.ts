/* Implementación MOCK del contrato: simula FROG y persiste en AsyncStorage.
   Es el equivalente de data.js + localStorage de la demo HTML.

   Cuando existan los endpoints reales NO se borra este archivo: sigue sirviendo para
   desarrollar sin backend. Solo se apaga con EXPO_PUBLIC_USE_MOCK=false. */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { construirReporte, construirResumen, upsertRegistro } from '../lib/rules';
import type { CensoApi } from './contract';
import type {
  Catalogos,
  Enfriador,
  EstadoEnfriador,
  RegistroCenso,
  RegistroCensoInput,
  TipoFoto,
} from './types';

const KEY = 'censo_registros_v1';

/** Latencia falsa para que la UI muestre sus estados de carga como con red real. */
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const CATALOGOS: Catalogos = {
  tipos: ['AAOCSA', 'PEÑAFIEL', 'BONAFONT'],
  estadosEnfriador: ['Usado Disponible', 'Descompuesto', 'Obsoleto', 'En Piso'],
  cedis: ['CEDIS Norte', 'CEDIS Sur', 'CEDIS Centro'],
  rutas: ['R-101', 'R-102', 'R-205', 'R-310'],
  marcas: ['Imbera', 'Metalfrio', 'Ojeda', 'Criotec'],
};

/** Base FROG simulada. Lo que no está aquí => status NUEVO. */
export const FROG: Enfriador[] = [
  {
    numeroSerie: 'IMB-100238', numeroCliente: 'CL-4471', nombreCliente: 'Abarrotes La Esquina',
    direccion: 'Av. Reforma 128, Col. Centro', cedis: 'CEDIS Centro', ruta: 'R-101',
    marca: 'Imbera', modelo: 'VR-08', tipo: 'AAOCSA',
  },
  {
    numeroSerie: 'MTF-559012', numeroCliente: 'CL-8830', nombreCliente: 'Tienda Don Beto',
    direccion: 'Calle 5 de Mayo 44, Col. Juárez', cedis: 'CEDIS Norte', ruta: 'R-205',
    marca: 'Metalfrio', modelo: 'VN-50', tipo: 'PEÑAFIEL',
  },
  {
    numeroSerie: 'OJE-778341', numeroCliente: 'CL-1290', nombreCliente: 'Minisuper El Sol',
    direccion: 'Blvd. Hidalgo 900, Col. Moderna', cedis: 'CEDIS Sur', ruta: 'R-310',
    marca: 'Ojeda', modelo: 'OJ-12', tipo: 'BONAFONT',
  },
  {
    numeroSerie: 'CRI-903115', numeroCliente: 'CL-6654', nombreCliente: 'Fonda Marisol',
    direccion: 'Av. Universidad 12, Col. Del Valle', cedis: 'CEDIS Centro', ruta: 'R-102',
    marca: 'Criotec', modelo: 'CR-19', tipo: 'AAOCSA',
  },
  {
    numeroSerie: 'IMB-100777', numeroCliente: 'CL-3321', nombreCliente: 'Deposito La Bendicion',
    direccion: 'Calle Pino 7, Col. Bosques', cedis: 'CEDIS Norte', ruta: 'R-101',
    marca: 'Imbera', modelo: 'VR-08', tipo: 'PEÑAFIEL',
  },
  {
    numeroSerie: 'MTF-441002', numeroCliente: 'CL-9902', nombreCliente: 'Cremería Guadalupe',
    direccion: 'Av. Morelos 210, Col. Centro', cedis: 'CEDIS Sur', ruta: 'R-205',
    marca: 'Metalfrio', modelo: 'VN-28', tipo: 'BONAFONT',
  },
];

/** Series sugeridas en la pantalla de búsqueda para probar sin escanear. */
export const SERIES_DEMO = FROG.map((f) => f.numeroSerie);

/** Registros sembrados para que Historial y Dashboard no arranquen vacíos. */
const SEED: RegistroCenso[] = [
  {
    ...FROG[3],
    status: 'CORRECTO', estadoEnfriador: 'Usado Disponible', observaciones: '',
    lat: 19.4212, lng: -99.1671, censado: 'SI', usuario: 'demo',
    fecha: '2026-07-21T10:14:00.000Z', fotos: [],
  },
  {
    ...FROG[5],
    status: 'CORRECCIÓN', estadoEnfriador: 'Descompuesto',
    observaciones: 'Equipo en reparación, falta parrilla.',
    lat: 19.3455, lng: -99.1802, censado: 'SI', usuario: 'demo',
    fecha: '2026-07-22T16:40:00.000Z', fotos: [],
  },
  {
    numeroSerie: 'NEW-000501', numeroCliente: 'BODEGA', nombreCliente: 'BODEGA',
    direccion: 'CEDIS Norte', cedis: 'CEDIS Norte', ruta: 'R-101',
    marca: 'Imbera', modelo: 'VR-08', tipo: 'AAOCSA',
    status: 'NUEVO', estadoEnfriador: 'En Piso', observaciones: 'Equipo recién llegado a bodega.',
    lat: 19.5001, lng: -99.14, censado: 'SI', usuario: 'demo',
    fecha: '2026-07-23T09:05:00.000Z', fotos: [],
  },
];

async function leer(): Promise<RegistroCenso[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw) as RegistroCenso[];
  await AsyncStorage.setItem(KEY, JSON.stringify(SEED));
  return [...SEED];
}

async function escribir(records: RegistroCenso[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

export const mockApi: CensoApi = {
  async lookupEnfriador(numeroSerie) {
    await delay();
    const serie = numeroSerie.trim().toUpperCase();
    return FROG.find((f) => f.numeroSerie === serie) ?? null;
  },

  async listRegistros() {
    await delay();
    return leer();
  },

  async saveRegistro(input: RegistroCensoInput) {
    await delay(400);
    const rec: RegistroCenso = { ...input, censado: 'SI' }; // §8
    await escribir(upsertRegistro(await leer(), rec));
    return rec;
  },

  async getResumen(_ruta?: string) {
    // El mock ignora la ruta: FROG simulado es uno solo.
    await delay();
    return construirResumen(await leer(), FROG, CATALOGOS);
  },

  async getReporte() {
    await delay();
    return construirReporte(await leer(), FROG, CATALOGOS);
  },

  async subirFoto(uri: string, tipo: TipoFoto) {
    await delay(150);
    // Sin backend la foto se queda en el dispositivo; solo se le inventa un id.
    return { id: `mock-${tipo}-${uri.slice(-8)}`, uri };
  },

  async getCatalogos() {
    return CATALOGOS;
  },

  async resetDemo() {
    await AsyncStorage.removeItem(KEY);
  },
};

/** Coordenadas simuladas alrededor de CDMX cuando no hay GPS disponible. */
export function gpsMock(semilla = 0) {
  return {
    lat: 19.4326 + (semilla % 7) * 0.006,
    lng: -99.1332 - (semilla % 5) * 0.006,
    mock: true,
  };
}

/** Estados válidos exportados aparte porque el formulario los necesita tipados. */
export const ESTADOS: EstadoEnfriador[] = CATALOGOS.estadosEnfriador;
